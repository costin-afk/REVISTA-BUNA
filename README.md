# ⚽ REVISTA BUNA – Football Match Magazine v2

Aplicație web cu 13 pagini tip revistă, swipe stânga/dreapta, vot live.

## 🚀 Instalare

```bash
npm install
node server.js
```

## 🔐 Admin
- URL: `/admin`
- User: `admin` | Parolă: `fotbal2024`

## 📱 Structura Revistei (13 pagini)

- **Pag 1** – Copertă (foto + titlu editabil)
- **Pag 2-3** – Avancronica (2 × 600 caractere)
- **Pag 4-5** – Jucător cheie (foto portret + titlu + subtitlu + text)
- **Pag 6** – Clasament (foto + titlu editabil)
- **Pag 7** – Formație echipa gazdă (teren interactiv: 4-3-3 / 4-4-2 / 4-2-3-1 / 3-4-3)
- **Pag 8** – Formație echipa oaspete (același format)
- **Pag 9** – Head to Head (titlu + text)
- **Pag 10** – Ce spun antrenorii (titlu + text)
- **Pag 11** – Pagina de Istorie (titlu + text)
- **Pag 12** – Reclamă embed (HTML/iframe)
- **Pag 13** – Jucătorul Meciului (vot live, 3 candidați, bare cu procente)

## ✨ Features
- Swipe stânga/dreapta între pagini
- Vot live: un vot/dispozitiv cu posibilitate de schimbare
- 3 culori per echipă
- Contor de caractere în admin
- QR Code descărcabil per meci
