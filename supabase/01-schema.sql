-- Run once in a fresh Supabase project's SQL Editor as project owner.
begin;
create schema if not exists opinatii_private;
revoke all on schema opinatii_private from public, anon, authenticated;
create table opinatii_private.admins(user_id uuid primary key references auth.users on delete cascade);
create function public.op_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from opinatii_private.admins where user_id=(select auth.uid()))
$$;
revoke all on function public.op_admin() from public;
grant execute on function public.op_admin() to anon,authenticated;

create table public.op_categories(
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 1 and 120),
 created_at timestamptz not null default now()
);
create unique index op_category_name on public.op_categories(lower(trim(name)));
create sequence public.op_position;
create table public.op_photos(
 id uuid primary key default gen_random_uuid(), category_id uuid not null references public.op_categories on delete cascade,
 label text not null check(length(trim(label)) between 1 and 250),
 asset uuid unique, original text check(original ~ '^[a-z0-9-]+$'),
 published boolean not null default false, cover boolean not null default false,
 position bigint not null default nextval('public.op_position'), check(num_nonnulls(asset,original)=1),check(not cover or published)
);
create unique index op_one_cover on public.op_photos(category_id) where cover;
create index op_gallery_order on public.op_photos(category_id,position,id);
create table public.op_packages(
 id uuid primary key default gen_random_uuid(), service text not null check(service in ('weddings','events','portraits','editorial')),
 days smallint not null check((service='weddings' and days in (1,2)) or (service<>'weddings' and days=0)),
 name text not null check(length(trim(name)) between 1 and 160), price text not null default '', description text not null default '',
 inclusions text[] not null default '{}', published boolean not null default false,
 position bigint not null default nextval('public.op_position'), revision bigint not null default 0
);
create function opinatii_private.revise() returns trigger language plpgsql as $$begin new.revision=old.revision+1; return new; end$$;
create trigger op_revision before update on public.op_packages for each row execute function opinatii_private.revise();
create table public.op_cleanup(asset uuid primary key, after_time timestamptz not null default now());
-- A reservation also identifies unfinished uploads after an interrupted session.
create function opinatii_private.photo_changes() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op <> 'INSERT' then
   if old.asset is not null and (tg_op='DELETE' or old.asset is distinct from new.asset) then
     insert into public.op_cleanup values(old.asset,now()) on conflict(asset) do update set after_time=now();
   end if;
 end if;
 if tg_op<>'DELETE' then
   if new.asset is not null then delete from public.op_cleanup where asset=new.asset; end if;
   if not new.published or (tg_op='UPDATE' and new.category_id<>old.category_id) then new.cover=false; end if;
   return new;
 end if;
 return old;
end$$;
create trigger op_photo_changes before insert or update or delete on public.op_photos for each row execute function opinatii_private.photo_changes();
do $$declare t text;begin
 foreach t in array array['op_categories','op_photos','op_packages','op_cleanup'] loop
   execute format('alter table public.%I enable row level security',t);
   execute format('revoke all on public.%I from public,anon,authenticated',t);
   execute format('grant select, insert, update, delete on public.%I to authenticated',t);
   execute format('create policy op_manage on public.%I for all to authenticated using ((select public.op_admin())) with check ((select public.op_admin()))',t);
   if t<>'op_cleanup' then
     execute format('grant select on public.%I to anon',t);
     execute format('create policy op_read on public.%I for select to anon,authenticated using (%s)',t,case when t='op_categories' then 'true' else 'published' end);
   end if;
 end loop;
end$$;
grant usage on sequence public.op_position to authenticated;
create function public.op_cover(photo uuid) returns void language plpgsql security invoker set search_path=public,pg_temp as $$
declare cat uuid;
begin
 if not op_admin() then raise exception 'Administrator required'; end if;
 select category_id into strict cat from op_photos where id=photo and published;
 perform 1 from op_categories where id=cat for update;
 update op_photos set cover=false where category_id=cat and cover;
 update op_photos set cover=true where id=photo and category_id=cat and published;
 if not found then raise exception 'Photograph changed. Refresh and try again.'; end if;
end$$;
-- A JSON request body keeps bulk selection independent of URL length limits.
create function public.op_delete_photos(category uuid, photos uuid[]) returns integer
language plpgsql security invoker set search_path=public,pg_temp as $$
declare deleted integer;
begin
 if not op_admin() then raise exception 'Administrator required'; end if;
 delete from op_photos where category_id=category and id=any(photos);
 get diagnostics deleted=row_count;
 return deleted;
end$$;
revoke all on function public.op_delete_photos(uuid,uuid[]) from public,anon;
grant execute on function public.op_delete_photos(uuid,uuid[]) to authenticated;
create function public.op_shift(kind text, item uuid, step integer) returns void language plpgsql security invoker set search_path=public,pg_temp as $$
declare tbl text; group_expr text; neighbor uuid; a bigint; b bigint;
begin
 if not op_admin() or step not in (-1,1) or kind not in ('photo','package') then raise exception 'Invalid reorder request'; end if;
 tbl=case kind when 'photo' then 'op_photos' else 'op_packages' end;
 group_expr=case kind when 'photo' then 'p.category_id=q.category_id' else 'p.service=q.service and p.days=q.days' end;
 execute format('lock table %I in share row exclusive mode',tbl);
 execute format('select p.id,p.position,q.position from %I p join %I q on %s where q.id=$1 and (p.position,p.id) %s (q.position,q.id) order by p.position %s,p.id %s limit 1',tbl,tbl,group_expr,case step when 1 then '>' else '<' end,case step when 1 then 'asc' else 'desc' end,case step when 1 then 'asc' else 'desc' end) into neighbor,b,a using item;
 if neighbor is not null then execute format('update %I set position=case id when $1 then $2 else $3 end where id in ($1,$4)',tbl) using item,b,a,neighbor;end if;
end$$;
revoke all on function public.op_shift(text,uuid,integer),public.op_cover(uuid) from public,anon;
grant execute on function public.op_shift(text,uuid,integer),public.op_cover(uuid) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('opinatii-gallery','opinatii-gallery',false,6291456,array['image/webp']);
create policy op_object_insert on storage.objects for insert to authenticated with check (
 bucket_id='opinatii-gallery' and (select public.op_admin()) and name ~ '^[0-9a-f-]{36}/(preview|full)\.webp$'
);
create policy op_object_read on storage.objects for select to authenticated,anon using (
 bucket_id='opinatii-gallery' and ((select public.op_admin()) or exists(
 select 1 from public.op_photos p where p.published and p.asset::text=split_part(storage.objects.name,'/',1)
 and split_part(storage.objects.name,'/',2) in ('preview.webp','full.webp')
 ))
);
create policy op_object_delete on storage.objects for delete to authenticated using (
 bucket_id='opinatii-gallery' and (select public.op_admin()) and not exists(
 select 1 from public.op_photos p where p.asset::text=split_part(storage.objects.name,'/',1)
 ));
commit;
