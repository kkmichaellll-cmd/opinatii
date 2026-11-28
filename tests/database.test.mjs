import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { PGlite } from "@electric-sql/pglite";

// Real PostgreSQL policies and triggers, with local fixtures for the Supabase-owned schemas.
test("import, authorization, publication, ordering, storage lifecycle and revocation", async () => {
  const pg = new PGlite();
  const sql = async (name) =>
    pg.exec(
      await readFile(new URL("../supabase/" + name, import.meta.url), "utf8"),
    );
  const q = async (s, args = []) => (await pg.query(s, args)).rows;
  const admin = "00000000-0000-4000-8000-000000000001",
    other = "00000000-0000-4000-8000-000000000002";
  try {
    await pg.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(bucket_id text,name text);alter table storage.objects enable row level security;
 grant usage on schema storage,auth to anon,authenticated;
 grant select,insert,delete on storage.objects to anon,authenticated;`);
    await sql("01-schema.sql");
    await sql("02-import.sql");
    await sql("02-import.sql");
    await q("insert into auth.users values($1),($2)", [admin, other]);
    await q("insert into opinatii_private.admins values($1)", [admin]);
    const original = vm.runInNewContext(
      (await readFile(new URL("../pricing-data.js", import.meta.url), "utf8")) +
        ";weddingCollections",
    );
    for (const days of [1, 2])
      assert.deepEqual(
        await q(
          "select name,price,inclusions from op_packages where days=$1 order by position",
          [days],
        ),
        JSON.parse(JSON.stringify(original[days])),
      );
    assert.equal((await q("select * from op_packages")).length, 18);
    assert.equal((await q("select * from op_photos")).length, 12);
    await sql("04-hero-gallery-links.sql");
    const hero = "f36e184c-5c9c-4a1e-a48d-fef40cde801e";
    const slides = await q("select * from op_photos where category_id=$1 order by position", [hero]);
    assert.deepEqual(slides.map(s => s.original), ["love", "bride", "couple", "wedding", "wedding", "footer-wedding-0", "kiss"]);
    await q("delete from op_photos where id=$1", [slides[0].id]);
    await sql("04-hero-gallery-links.sql");
    assert.equal((await q("select id from op_photos where category_id=$1", [hero])).length, 6);
    await assert.rejects(q("update op_photos set link_url='javascript:alert(1)' where id=$1", [slides[1].id]));
    async function role(name, sub = "") {
      await pg.exec("reset role;set role " + name);
      await q("select set_config('request.jwt.claim.sub',$1,false)", [sub]);
    }
    await role("anon");
    await assert.rejects(
      q("insert into op_categories(name) values ('Denied')"),
    );
    await role("authenticated", other);
    assert.equal((await q("select op_admin() ok"))[0].ok, false);
    await assert.rejects(
      q("insert into op_categories(name) values ('Denied')"),
    );
    await assert.rejects(q("select * from opinatii_private.admins"));
    await role("authenticated", admin);
    const [{ id: cat }] = await q(
      "insert into op_categories(name) values('New') returning id",
    );
    await q("update op_categories set name='Renamed' where id=$1", [cat]);
    const [{ id: dest }] = await q(
      "insert into op_categories(name) values('Destination') returning id",
    );
    const asset = "00000000-0000-4000-8000-000000000003";
    await q("insert into op_cleanup(asset) values($1)", [asset]);
    await q("insert into storage.objects values('opinatii-gallery',$1)", [
      asset + "/preview.webp",
    ]);
    const [{ id: photo }] = await q(
      "insert into op_photos(category_id,label,asset) values($1,'Draft',$2) returning id",
      [cat, asset],
    );
    assert.equal((await q("select * from op_cleanup")).length, 0);
    await role("anon");
    assert.equal(
      (await q("select id from op_photos where id=$1", [photo])).length,
      0,
    );
    assert.equal((await q("select * from storage.objects")).length, 0);
    await role("authenticated", other);
    await assert.rejects(
      q("insert into storage.objects values('opinatii-gallery',$1)", [
        asset + "/full.webp",
      ]),
    );
    await role("authenticated", admin);
    await q("update op_photos set published=true where id=$1", [photo]);
    await q("update op_photos set link_url='https://example.com' where id=$1", [photo]);
    await q("select op_cover($1)", [photo]);
    await role("anon");
    assert.equal((await q("select * from storage.objects")).length, 1);
    await role("authenticated", admin);
    await q("update op_photos set category_id=$1 where id=$2", [dest, photo]);
    assert.equal(
      (await q("select cover from op_photos where id=$1", [photo]))[0].cover,
      false,
    );
    const [{ id: second }] = await q(
      "insert into op_photos(category_id,label,original) values($1,'Second','event') returning id",
      [dest],
    );
    await q("select op_shift('photo',$1,-1)", [second]);
    assert.equal(
      (
        await q(
          "select id from op_photos where category_id=$1 order by position",
          [dest],
        )
      )[0].id,
      second,
    );
    await q("update op_photos set published=false where id=$1", [photo]);
    await role("anon");
    assert.equal((await q("select * from storage.objects")).length, 0);
    await role("authenticated", admin);
    const [pack] = await q(
      "insert into op_packages(service,days,name,price,inclusions) values('events',0,'Launch','₦50,000',array['A','B']) returning *",
    );
    await q(
      "update op_packages set published=true,price='₦60,000',inclusions=array['B','A'] where id=$1",
      [pack.id],
    );
    await q("select op_shift('package',$1,-1)", [pack.id]);
    await role("anon");
    assert.equal(
      (await q("select price from op_packages where id=$1", [pack.id]))[0]
        .price,
      "₦60,000",
    );
    await role("authenticated", admin);
    await q("delete from op_packages where id=$1", [pack.id]);
    await q("delete from op_categories where id=$1", [dest]);
    assert.equal((await q("select asset from op_cleanup"))[0].asset, asset);
    await q("delete from storage.objects where name=$1", [
      asset + "/preview.webp",
    ]);
    assert.equal((await q("select * from storage.objects")).length, 0);
    await pg.exec("reset role;delete from opinatii_private.admins");
    await role("authenticated", admin);
    assert.equal((await q("select op_admin() ok"))[0].ok, false);
  } finally {
    await pg.close();
  }
});
