# Harcamac Web

Harcamac'in React, Supabase ve Cloudflare Pages kullanan responsive web surumudur.

## Yerel calistirma

1. `.env.example` dosyasini `.env` olarak kopyalayin.
2. Supabase proje adresini ve `anon` anahtarini `.env` icine girin.
3. Supabase SQL Editor'da `supabase/schema.sql` dosyasini calistirin.
4. `pnpm install` ve `pnpm dev` komutlarini calistirin.

## Supabase Auth

Supabase Dashboard > Authentication > URL Configuration alaninda:

- Site URL: Cloudflare Pages adresiniz
- Redirect URLs: `http://localhost:5173/**` ve Cloudflare Pages adresiniz

E-posta dogrulamasi Authentication > Providers > Email bolumunden acilip kapatilabilir.

## Cloudflare Pages

GitHub reposunu Cloudflare Pages'a baglarken asagidaki ayarlari kullanin:

- Production branch: `web-supabase`
- Root directory: `web`
- Build command: `pnpm build`
- Build output directory: `dist`

Settings > Environment variables alanina hem Production hem Preview icin ekleyin:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

`public/_redirects`, istemci tarafindaki rotalarin yenilendiginde Cloudflare tarafindan `index.html` dosyasina yonlenmesini saglar.

## Guvenlik

`schema.sql` dosyasi Row Level Security politikalarini etkinlestirir. Kullanici yalnizca kendi kategori, hareket ve varlik kayitlarini okuyabilir veya degistirebilir. `service_role` anahtari istemciye ya da Cloudflare ortam degiskenlerine eklenmemelidir.
