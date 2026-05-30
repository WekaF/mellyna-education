This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

---

## 🔑 Akun & Kredensial Demo (Seed Database)

Semua akun demo bawaan berikut telah dibuat secara otomatis melalui script `prisma/seed.ts`. Anda dapat menggunakannya untuk login ke masing-masing dashboard peran.

### 1. Akun Orang Tua (Role: `PARENT`)
*   **Email Default**: `parent@mellyna.id` (Bunda Almeer - memiliki 2 anak terdaftar: *Almeer* & *Kaisya*)
*   **Email Tambahan**: `parent.2@mellyna.id` s.d. `parent.20@mellyna.id`
*   **Kata Sandi**: `parent123` *(Sama untuk semua akun parent)*

### 2. Akun Tutor / Pengajar (Role: `TUTOR`)
*   **Email Default**: `tutor@mellyna.id` (Pak Budi)
*   **Email Tambahan**: 
    *   `tutor.linda@mellyna.id` (Ibu Linda)
    *   `tutor.heri@mellyna.id` (Pak Heri)
*   **Kata Sandi**: `tutor123` *(Sama untuk semua akun tutor)*

### 3. Akun Pengelola Utama (Role: `SUPER_ADMIN`)
*   **Email**: `admin@mellyna.id`
*   **Kata Sandi**: `admin123`

---

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
