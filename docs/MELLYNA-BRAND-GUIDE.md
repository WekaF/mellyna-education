# 🦉 Mellyna Education — Brand Implementation Guide
**mellyna-education.my.id**

---

## 📁 File yang Tersedia

| File | Digunakan untuk |
|------|----------------|
| `mellyna-logo-primary.svg` | Website header, proposal, kop surat, materi cetak (bg putih) |
| `mellyna-logo-dark.svg` | Banner, slide, footer, bg gelap |
| `mellyna-logo-horizontal-compact.svg` | Header website, email header, invoice header |
| `mellyna-icon-512.svg` | Favicon, PWA app icon, social media profile |
| `mellyna-icon-192.svg` | Android icon, thumbnail, app store |
| `mellyna-brand-tokens.css` | Design system warna/font untuk semua halaman |

---

## 🎨 Brand Colors

| Token | Hex | Digunakan |
|-------|-----|-----------|
| `--me-primary` | `#1A56DB` | Button, heading, link, badge |
| `--me-primary-dark` | `#0C1A5C` | Footer, dark section, text heading |
| `--me-yellow` | `#FFE566` | Aksen, highlight, star, underline logo |
| `--me-orange` | `#FF8C00` | Subheading "EDUCATION", CTA sekunder |
| `--me-coral` | `#FF6B6B` | Error, alert merah |
| `--me-green` | `#4FD1A5` | Success, konfirmasi bayar |
| `--me-bg` | `#F7FAFF` | Background halaman |
| `--me-surface` | `#EEF4FF` | Background card |

---

## 🌐 Implementasi Website (Next.js / HTML)

### 1. Setup Font & Token
```html
<!-- di <head> -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@400;700;900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/brand/mellyna-brand-tokens.css">

<!-- Favicon -->
<link rel="icon" type="image/svg+xml" href="/brand/mellyna-icon-192.svg">
<link rel="apple-touch-icon" href="/brand/mellyna-icon-512.svg">
```

### 2. Header / Navbar
```html
<header style="background: var(--me-white); border-bottom: 2px solid var(--me-yellow); padding: 0 2rem;">
  <img src="/brand/mellyna-logo-horizontal-compact.svg"
       alt="Mellyna Education"
       height="64"
       style="display:block;">
</header>
```

### 3. Tailwind CSS Config (jika pakai Tailwind)
```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        'me-primary':     '#1A56DB',
        'me-primary-dark':'#0C1A5C',
        'me-yellow':      '#FFE566',
        'me-orange':      '#FF8C00',
        'me-coral':       '#FF6B6B',
        'me-green':       '#4FD1A5',
        'me-bg':          '#F7FAFF',
        'me-surface':     '#EEF4FF',
        'me-border':      '#D6E4FF',
        'me-text':        '#0C1A5C',
        'me-muted':       '#6A7FB8',
      },
      fontFamily: {
        heading: ['Fredoka One', 'Arial Rounded MT Bold', 'sans-serif'],
        body:    ['Nunito', 'Segoe UI', 'sans-serif'],
      },
      borderRadius: {
        'brand': '16px',
        'brand-lg': '24px',
      },
      boxShadow: {
        'brand': '0 4px 16px rgba(26,86,219,0.12)',
        'brand-lg': '0 8px 32px rgba(26,86,219,0.16)',
      }
    }
  }
}
```

---

## 🧾 Invoice / Laporan Keuangan

### Header Invoice
```html
<div style="
  background: #0C1A5C;
  padding: 24px 32px;
  border-radius: 16px 16px 0 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
">
  <img src="/brand/mellyna-logo-dark.svg" alt="Mellyna Education" height="60">
  <div style="text-align:right; color:#ffffff;">
    <div style="font-size:13px; color:#FFE566; font-weight:700; letter-spacing:2px;">INVOICE</div>
    <div style="font-size:22px; font-weight:900;">#INV-2024-001</div>
    <div style="font-size:12px; color:#7BAEE8;">mellyna-education.my.id</div>
  </div>
</div>

<!-- Body Invoice -->
<div style="
  background: #ffffff;
  border: 1px solid #D6E4FF;
  border-top: 4px solid #FFE566;
  padding: 32px;
">
  <!-- Tabel invoice dengan warna brand -->
  <table style="width:100%; border-collapse:collapse;">
    <thead>
      <tr style="background: #EEF4FF;">
        <th style="padding:12px 16px; text-align:left; color:#0C1A5C; font-family:'Nunito',sans-serif; border-bottom:2px solid #1A56DB;">Item</th>
        <th style="padding:12px 16px; text-align:right; color:#0C1A5C; font-family:'Nunito',sans-serif; border-bottom:2px solid #1A56DB;">Jumlah</th>
        <th style="padding:12px 16px; text-align:right; color:#0C1A5C; font-family:'Nunito',sans-serif; border-bottom:2px solid #1A56DB;">Total</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="padding:12px 16px; color:#2D3A6B; border-bottom:1px solid #E8F0FF;">SPP Bulan Juli 2024</td>
        <td style="padding:12px 16px; text-align:right; color:#2D3A6B; border-bottom:1px solid #E8F0FF;">1x</td>
        <td style="padding:12px 16px; text-align:right; color:#2D3A6B; border-bottom:1px solid #E8F0FF;">Rp 350.000</td>
      </tr>
    </tbody>
    <tfoot>
      <tr style="background:#0C1A5C;">
        <td colspan="2" style="padding:14px 16px; color:#FFE566; font-weight:700;">TOTAL</td>
        <td style="padding:14px 16px; text-align:right; color:#ffffff; font-weight:900; font-size:18px;">Rp 350.000</td>
      </tr>
    </tfoot>
  </table>
</div>
```

---

## 📊 Dashboard

### Stat Card Component
```html
<div style="
  background: #ffffff;
  border: 1px solid #D6E4FF;
  border-top: 4px solid #1A56DB;
  border-radius: 16px;
  padding: 20px 24px;
  box-shadow: 0 4px 16px rgba(26,86,219,0.10);
">
  <div style="font-size:12px; color:#6A7FB8; font-weight:700; letter-spacing:1px; text-transform:uppercase;">Total Siswa</div>
  <div style="font-size:36px; font-weight:900; color:#0C1A5C; margin:4px 0;">142</div>
  <div style="font-size:13px; color:#4FD1A5; font-weight:700;">↑ +8 bulan ini</div>
</div>
```

### Status Badge
```html
<!-- Lunas -->
<span style="background:#E6FBF5; color:#0A6B52; padding:4px 12px; border-radius:999px; font-size:12px; font-weight:700;">✓ Lunas</span>

<!-- Pending -->
<span style="background:#FFF4E0; color:#7A3D00; padding:4px 12px; border-radius:999px; font-size:12px; font-weight:700;">⏳ Pending</span>

<!-- Belum Bayar -->
<span style="background:#FFF0F0; color:#8B0000; padding:4px 12px; border-radius:999px; font-size:12px; font-weight:700;">✕ Belum Bayar</span>
```

---

## 🚀 Prompt untuk AI / Developer

Gunakan prompt berikut saat meminta AI (Claude, ChatGPT, dll.) membuat komponen untuk project SISTRO / Mellyna Education:

```
Buatkan [komponen/halaman] untuk platform Mellyna Education 
(lembaga kursus anak SD, website: mellyna-education.my.id).

Brand identity:
- Logo: burung hantu memegang buku, font "Fredoka One" untuk nama brand
- Primary color: #1A56DB (navy blue)
- Accent yellow: #FFE566
- Orange subtext: #FF8C00
- Success: #4FD1A5, Error: #FF6B6B
- Background: #F7FAFF, Surface/card: #EEF4FF
- Border: #D6E4FF
- Text heading: #0C1A5C, Body: #2D3A6B, Muted: #6A7FB8
- Font heading: "Fredoka One", Font body: "Nunito"
- Border radius default: 16px, shadow: 0 4px 16px rgba(26,86,219,0.12)
- Tone: playful, fun, ramah anak, tapi tetap profesional

Gunakan CSS custom properties dengan prefix --me- sesuai mellyna-brand-tokens.css.
Stack: [Next.js 14 / React / HTML+CSS — pilih sesuai project]
```

---

## 📂 Struktur Folder yang Disarankan

```
/public
  /brand
    mellyna-logo-primary.svg        ← light bg
    mellyna-logo-dark.svg           ← dark bg
    mellyna-logo-horizontal-compact.svg  ← header website
    mellyna-icon-512.svg            ← favicon / app icon
    mellyna-icon-192.svg            ← android / thumbnail
    mellyna-brand-tokens.css        ← import di global CSS

/src/styles
  globals.css   ← @import '../public/brand/mellyna-brand-tokens.css'
```

---

*Mellyna Education Brand System v1.0 — 2024*
