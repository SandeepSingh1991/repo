# Private Media Vault Setup

Agar login nahi ho raha hai, sabse common reason ye hota hai ki **Supabase Auth user** aur **`users_role` table** me email same nahi hai.

## Working login steps

1. Supabase Dashboard → **Authentication → Users** me user banao.
   - Example: `admin@gmail.com`
2. Repo ka **`supabase-schema.sql`** SQL Editor me run karo.
3. Confirm karo ki `users_role` me exact same email ho:

```sql
insert into public.users_role (email, role)
values
  ('admin@gmail.com', 'admin'),
  ('user@gmail.com', 'user')
on conflict (email) do update set role = excluded.role;
```

## Important

- `admin@gmail.com` ko Auth me bhi create karna hai.
- Agar Auth me `admin@gmail.com` hai lekin `users_role` me `admin@example.com` hai, to login fail jaisa behavior aayega kyunki role resolve nahi hoga.
- Videos ke liye Google Drive link ka format `/preview` hona chahiye, `/view` nahi.

## Tables used

- `content` → videos/photos metadata
- `users_role` → `admin` ya `user`

## Hosting

- Frontend: GitHub Pages
- Auth + DB: Supabase
