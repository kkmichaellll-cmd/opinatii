# Opinatii Photography

The recovered homepage, the existing pricing page, a public gallery at `/gallery`, and an email/password studio at `/admin`. Gallery opens after sign-in. Supabase stores the administrator allowlist, content and uploaded images. Vercel serves the website.

## 1. Configure Supabase

1. Create a Supabase project. Use a dedicated project so its sign-up setting and storage policies can be managed independently.
2. In Authentication settings, enable the Email provider, turn **Allow new users to sign up** off, and disable anonymous sign-ins. Save. Keep the Auth Site URL set to the HTTPS address of your website.
3. In the SQL Editor, run **supabase/01-schema.sql** once. It creates the tables, database permissions, private administrator allowlist, private `opinatii-gallery` bucket and object policies.
4. Run **supabase/02-import.sql**. It imports the recovered collections and 12 existing website photographs under Weddings, Events, Studio & Portraits and Editorial. The transaction records a completed import. Re-running it preserves subsequent edits and deletions.
5. Under the project's Data API settings, enable the API and expose the `public` schema. Keep `opinatii_private` outside the exposed schemas. The SQL grants access to the appropriate tables and functions. Use the default API row limit of 1,000 or a limit of at least 100.
6. Open the project's Connect dialog or Project Settings → API Keys. Copy your project URL and **publishable** key. The build accepts an HTTPS project URL and an `sb_publishable_` key. The browser uses these public values. The application requires no service-role key, secret API key, JWT signing secret or database password.

## 2. Create the administrator

In **Authentication → Users → Add user → Create new user**, enter the administrator's email and a strong unique password. Select **Auto Confirm User** or complete email confirmation. Copy the resulting user's UUID. Replace the placeholder in **supabase/03-authorize-admin.sql** with that UUID and run it in the SQL Editor.

Only allowlisted accounts can access editing controls or modify the database and storage. Adding a user to Authentication alone grants no editing permissions. For password changes use the project owner's Auth administration workflow. To revoke an administrator, delete that user's row from `opinatii_private.admins` in the SQL Editor. Subsequent write requests check membership in the database.

## 3. Deploy to Vercel

Extract the ZIP. The project root is the folder containing `package.json` and `vercel.json`. Upload its contents, including `assets`, `cms`, `scripts` and the lockfile, to a GitHub repository. Import it into Vercel, or connect the repository to the existing Opinatii Vercel project. For CLI deployment, open a terminal in this folder, run `npx vercel link`, select the intended project, configure the environment variables in its dashboard, then run `npx vercel --prod`.

| Project setting | Value |
| --- | --- |
| Framework preset | Other |
| Node.js | 22.x or 24.x |
| Install command | npm ci |
| Build command | npm run build |
| Output directory | dist |
| SUPABASE_URL | Your HTTPS project URL |
| SUPABASE_PUBLISHABLE_KEY | Your project's sb_publishable_ key |

Set both environment variables for Production and any Preview environment you plan to use. Use a separate Supabase project for previews if editing preview content should be independent of production. The ZIP includes `.env.example`. Deploy the project, visit `/admin` and sign in. The build publishes only the contents of `dist`. SQL, setup instructions and tests stay outside the static site.

For a local build with Node 22.9+ or 24, copy `.env.example` to `.env.local`, fill in the two values, run `npm ci`, then `node --env-file=.env.local scripts/build.mjs`. Use `npx vercel dev` with the linked project to exercise clean URLs locally. A double-clicked HTML file does not run the application.

## Gallery workflow

Choose or create a category, choose files or drag them onto the upload area, review the previews, select their publication state and press Upload. The studio processes files one at a time and reports progress. A failed batch keeps unfinished photographs in the queue. Supported input is JPEG, PNG, WebP and AVIF where the browser can decode them, up to 40 MB per original. Uploads produce a preview of up to 800 px and a large version of up to 2,560 px on the longest edge. Neither is upscaled.

Each card supports earlier/later ordering, moving, replacing, deletion, publication and cover selection. Hover an icon or focus it with a screen reader for its action name. Use the checkboxes for bulk deletion. A category is public when it contains a published photograph. The first published photograph in display order supplies the cover until you set one explicitly. Moving or unpublishing a cover clears its cover designation. Replacing keeps the photograph's identity and position.

The recovered archive included gallery links but no gallery page or separate gallery archive. Those links now open the local managed gallery. The initial gallery references the supplied, publicly bundled homepage assets. Removing or unpublishing one removes it from the managed gallery. Its original homepage use is preserved. Newly uploaded files live in private Supabase Storage. Public visitors receive five-minute signed URLs for published uploads. A previously issued URL may work until it expires.

Deleted and superseded storage objects enter a database-backed cleanup queue. Authenticated admin sessions process the queue on login and after saved changes. Interrupted uploads are eligible after 24 hours. Requests delete storage through the Storage API. Logical removal from the gallery takes effect when the database operation commits.

## Pricing workflow

Select Weddings, Events, Studio & Portraits or Editorial. Wedding coverage has separate one-day and two-day collections. Edit a package's display price, description, publication status and ordered feature list, or create and reorder packages. Prices accept the original Naira formatting. A blank price displays the original “Pricing to be confirmed” text.

The import contains every name, price and inclusion in the six supplied wedding options. The original Events, Studio & Portraits and Editorial sections each contained four “Package 1” through “Package 4” entries with no prices or inclusions. The import preserves those entries for editing. The existing tabs, duration toggle, pricing cards and enquiry links use the managed data.

Public pages read published content on load, refresh when the visitor returns to the tab, and check for changes every 30 seconds while visible. Content edits require no rebuild. Changing the Supabase project URL or key requires a new build.

## Verification

Run `npm ci` and `npm test` with Node 22 or 24. The included test runs the delivered SQL against PostgreSQL in PGlite, compares all wedding packages and inclusions to the recovered source, and exercises roles, publication, upload-object access, ordering, cover changes, cascading deletion, cleanup and revocation. It creates disposable fixtures and leaves the configured Supabase project untouched.

Before packaging, the site passed Chromium tests against local Supabase Auth, PostgREST, PostgreSQL and Supabase Storage with its filesystem backend. Checks covered invalid credentials, public signup disabled, non-admin rejection, administrator login and logout, drag-and-drop batch upload, private signed downloads, category creation and renaming, photograph replacement, moving, ordering, covers, publication and deletion. A separate visitor browser session verified gallery visibility and a changed price appearing in an already-open pricing page. The mobile checks used 360 px and 390 px wide viewports. The tests used disposable accounts.

After deployment, sign in, upload a photograph to a test category, and open the gallery in a private window. Set the cover, unpublish and republish the photograph, then check the public view. Add a test pricing package, edit its price and features, and check it from the private window. Confirm both wedding day tabs, then remove the test content through the admin.

Official references:

- [Supabase Auth configuration](https://supabase.com/docs/guides/auth/general-configuration)
- [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control)
- [Vercel build configuration](https://vercel.com/docs/builds/configure-a-build)
