-- Replace the placeholder with the UUID from Authentication > Users.
-- Run this in the Supabase SQL Editor after creating and confirming the account.
do $$
declare account_id uuid := 'REPLACE_WITH_AUTH_USER_UUID';
begin
 if not exists(select 1 from auth.users where id=account_id and email_confirmed_at is not null)
 then raise exception 'Create and confirm the email account first.'; end if;
 insert into opinatii_private.admins(user_id) values(account_id) on conflict do nothing;
end$$;
