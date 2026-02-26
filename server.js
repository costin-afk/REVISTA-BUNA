const express = require('express');
const session = require('express-session');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'magazines.json');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(path.join(__dirname, 'data'))) fs.mkdirSync(path.join(__dirname, 'data'));
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify([]));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.fieldname + path.extname(file.originalname))
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({ secret: 'matchmag-secret-2024', resave: false, saveUninitialized: false }));

const ADMIN_USER = 'admin';
const ADMIN_PASS = 'fotbal2024';

function getMagazines() { try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch(e) { return []; } }
function saveMagazines(d) { fs.writeFileSync(DATA_FILE, JSON.stringify(d, null, 2)); }
function requireAuth(req, res, next) { if (req.session.loggedIn) return next(); res.redirect('/admin/login'); }

app.get('/', (req, res) => res.redirect('/admin'));
app.get('/match/:id', (req, res) => {
  const mag = getMagazines().find(m => m.id === req.params.id);
  if (!mag) return res.status(404).send('<h1 style="font-family:sans-serif;text-align:center;margin-top:100px">Revista nu a fost găsită</h1>');
  res.render('magazine', { mag });
});

app.post('/api/vote/:id', (req, res) => {
  const { candidate, previousCandidate } = req.body;
  const magazines = getMagazines();
  const idx = magazines.findIndex(m => m.id === req.params.id);
  if (idx === -1) return res.json({ error: 'Not found' });
  const mag = magazines[idx];
  if (mag.voteStopped) return res.json({ votes: mag.votes, voteStopped: true, mvp: mag.mvp });
  if (!mag.votes) mag.votes = { 0: 0, 1: 0, 2: 0 };
  if (previousCandidate !== undefined && previousCandidate !== null && previousCandidate !== '' && mag.votes[previousCandidate] > 0) mag.votes[previousCandidate]--;
  if (candidate !== undefined && mag.votes[candidate] !== undefined) mag.votes[candidate]++;
  saveMagazines(magazines);
  res.json({ votes: mag.votes, voteStopped: false });
});

app.get('/api/votes/:id', (req, res) => {
  const mag = getMagazines().find(m => m.id === req.params.id);
  if (!mag) return res.json({ error: 'Not found' });
  res.json({ votes: mag.votes || { 0: 0, 1: 0, 2: 0 }, voteStopped: mag.voteStopped || false, mvp: mag.mvp || null });
});

app.post('/admin/stop-vote/:id', requireAuth, (req, res) => {
  const magazines = getMagazines();
  const idx = magazines.findIndex(m => m.id === req.params.id);
  if (idx === -1) return res.json({ error: 'Not found' });
  const mag = magazines[idx];
  const votes = mag.votes || { 0: 0, 1: 0, 2: 0 };
  let maxV = -1, mvpIdx = 0;
  Object.entries(votes).forEach(([k, v]) => { if (v > maxV) { maxV = v; mvpIdx = parseInt(k); } });
  const candidates = [mag.voteCandidate0, mag.voteCandidate1, mag.voteCandidate2];
  mag.voteStopped = true;
  mag.mvp = candidates[mvpIdx] || '';
  saveMagazines(magazines);
  res.json({ success: true, mvp: mag.mvp });
});

app.post('/admin/start-vote/:id', requireAuth, (req, res) => {
  const magazines = getMagazines();
  const idx = magazines.findIndex(m => m.id === req.params.id);
  if (idx !== -1) { magazines[idx].voteStopped = false; magazines[idx].mvp = null; saveMagazines(magazines); }
  res.json({ success: true });
});

app.get('/admin/login', (req, res) => res.render('login', { error: null }));
app.post('/admin/login', (req, res) => {
  if (req.body.username === ADMIN_USER && req.body.password === ADMIN_PASS) { req.session.loggedIn = true; res.redirect('/admin'); }
  else res.render('login', { error: 'Utilizator sau parolă greșite!' });
});
app.get('/admin/logout', (req, res) => { req.session.destroy(); res.redirect('/admin/login'); });
app.get('/admin', requireAuth, (req, res) => res.render('admin-dashboard', { magazines: getMagazines() }));
app.get('/admin/new', requireAuth, (req, res) => res.render('admin-editor', { mag: null }));

const uploadFields = upload.fields([
  { name: 'cover', maxCount: 1 }, { name: 'clubLogo', maxCount: 1 },
  { name: 'playerPhoto', maxCount: 1 }, { name: 'homeLogoPhoto', maxCount: 1 },
  { name: 'awayLogoPhoto', maxCount: 1 }, { name: 'stadiumPhoto', maxCount: 1 },
  { name: 'palmaresPhoto', maxCount: 1 }, { name: 'homeCoachPhoto', maxCount: 1 },
  { name: 'awayCoachPhoto', maxCount: 1 }
]);

app.post('/admin/new', requireAuth, uploadFields, async (req, res) => {
  const magazines = getMagazines();
  const id = uuidv4();
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const matchUrl = `${baseUrl}/match/${id}`;
  const qrDataUrl = await QRCode.toDataURL(matchUrl, { width: 300, margin: 2 });
  const mag = buildMag(id, matchUrl, qrDataUrl, req);
  magazines.push(mag);
  saveMagazines(magazines);
  res.redirect(`/admin/magazine/${id}`);
});

app.get('/admin/magazine/:id', requireAuth, (req, res) => {
  const mag = getMagazines().find(m => m.id === req.params.id);
  if (!mag) return res.redirect('/admin');
  res.render('admin-view', { mag });
});

app.get('/admin/edit/:id', requireAuth, (req, res) => {
  const mag = getMagazines().find(m => m.id === req.params.id);
  if (!mag) return res.redirect('/admin');
  res.render('admin-editor', { mag });
});

app.post('/admin/edit/:id', requireAuth, uploadFields, (req, res) => {
  const magazines = getMagazines();
  const idx = magazines.findIndex(m => m.id === req.params.id);
  if (idx === -1) return res.redirect('/admin');
  const existing = magazines[idx];
  const updated = buildMag(existing.id, existing.matchUrl, existing.qrCode, req);
  ['cover','clubLogo','playerPhoto','homeLogoPhoto','awayLogoPhoto','stadiumPhoto','palmaresPhoto','homeCoachPhoto','awayCoachPhoto'].forEach(f => { if (!updated[f]) updated[f] = existing[f]; });
  updated.votes = existing.votes || { 0: 0, 1: 0, 2: 0 };
  updated.voteStopped = existing.voteStopped || false;
  updated.mvp = existing.mvp || null;
  magazines[idx] = updated;
  saveMagazines(magazines);
  res.redirect(`/admin/magazine/${existing.id}`);
});

app.post('/admin/delete/:id', requireAuth, (req, res) => { saveMagazines(getMagazines().filter(m => m.id !== req.params.id)); res.redirect('/admin'); });
app.post('/admin/reset-votes/:id', requireAuth, (req, res) => {
  const magazines = getMagazines();
  const idx = magazines.findIndex(m => m.id === req.params.id);
  if (idx !== -1) { magazines[idx].votes = { 0: 0, 1: 0, 2: 0 }; magazines[idx].voteStopped = false; magazines[idx].mvp = null; saveMagazines(magazines); }
  res.redirect(`/admin/magazine/${req.params.id}`);
});

function buildMag(id, matchUrl, qrCode, req) {
  const b = req.body;
  const files = req.files || {};
  const homeNums=[], homeNames=[], awayNums=[], awayNames=[];
  for (let i=0;i<11;i++) {
    homeNums.push((b[`homeNumber_${i}`]||'').toString());
    homeNames.push((b[`homeName_${i}`]||'').toString());
    awayNums.push((b[`awayNumber_${i}`]||'').toString());
    awayNames.push((b[`awayName_${i}`]||'').toString());
  }
  const h2hLabels = Array.isArray(b.h2hLabel)?b.h2hLabel:(b.h2hLabel?[b.h2hLabel]:[]);
  const h2hValues = Array.isArray(b.h2hValue)?b.h2hValue:(b.h2hValue?[b.h2hValue]:[]);
  const tocItems = Array.isArray(b.tocItem)?b.tocItem:(b.tocItem?[b.tocItem]:[]);
  return {
    id, matchUrl, qrCode, createdAt: new Date().toISOString(),
    homeTeam:b.homeTeam||'', awayTeam:b.awayTeam||'',
    homeColor1:b.homeColor1||'#e63946',
    homeColor2:b.useHomeColor2?b.homeColor2||'#ffffff':null,
    homeColor3:b.useHomeColor3?b.homeColor3||'#1d3557':null,
    awayColor1:b.awayColor1||'#457b9d',
    awayColor2:b.useAwayColor2?b.awayColor2||'#ffffff':null,
    awayColor3:b.useAwayColor3?b.awayColor3||'#1d3557':null,
    bgColor:b.bgColor||'#0d0d0d',
    bgTextColor:b.bgTextColor||'#ffffff',
    matchDate:b.matchDate||'', stadium:b.stadium||'', competition:b.competition||'',
    cover: files.cover?`/uploads/${files.cover[0].filename}`:null,
    clubLogo: files.clubLogo?`/uploads/${files.clubLogo[0].filename}`:null,
    logoPosition:b.logoPosition||'top-left',
    logoSize:b.logoSize||'medium',
    playerPhoto: files.playerPhoto?`/uploads/${files.playerPhoto[0].filename}`:null,
    homeLogoPhoto: files.homeLogoPhoto?`/uploads/${files.homeLogoPhoto[0].filename}`:null,
    awayLogoPhoto: files.awayLogoPhoto?`/uploads/${files.awayLogoPhoto[0].filename}`:null,
    stadiumPhoto: files.stadiumPhoto?`/uploads/${files.stadiumPhoto[0].filename}`:null,
    palmaresPhoto: files.palmaresPhoto?`/uploads/${files.palmaresPhoto[0].filename}`:null,
    homeCoachPhoto: files.homeCoachPhoto?`/uploads/${files.homeCoachPhoto[0].filename}`:null,
    awayCoachPhoto: files.awayCoachPhoto?`/uploads/${files.awayCoachPhoto[0].filename}`:null,
    coverTitle:b.coverTitle||'',
    tocItems:tocItems,
    avancronicaTitle:b.avancronicaTitle||'Avancronica',
    avancronicaP1:b.avancronicaP1||'', avancronicaP2:b.avancronicaP2||'',
    playerTitle:b.playerTitle||'', playerSubtitle:b.playerSubtitle||'', playerText:b.playerText||'',
    standingsTitle:b.standingsTitle||'Clasament',
    standingsEmbed:b.standingsEmbed||'',
    homeFormation:b.homeFormation||'4-3-3', homeFormationTitle:b.homeFormationTitle||'',
    homePlayerNumbers:homeNums, homePlayerNames:homeNames,
    awayFormation:b.awayFormation||'4-3-3', awayFormationTitle:b.awayFormationTitle||'',
    awayPlayerNumbers:awayNums, awayPlayerNames:awayNames,
    homeReserves:b.homeReserves||'', awayReserves:b.awayReserves||'',
    h2hTitle:b.h2hTitle||'Întâlniri directe', h2hLabels:h2hLabels, h2hValues:h2hValues,
    h2hYoutubeEmbed:b.h2hYoutubeEmbed||'',
    coachesTitle:b.coachesTitle||'Ce spun antrenorii',
    homeCoachName:b.homeCoachName||'', homeCoachText:b.homeCoachText||'',
    awayCoachName:b.awayCoachName||'', awayCoachText:b.awayCoachText||'',
    palmaresTitle:b.palmaresTitle||'Palmares', palmaresText:b.palmaresText||'',
    adTitle:b.adTitle||'', adEmbed:b.adEmbed||'',
    voteCandidate0:b.voteCandidate0||'', voteCandidate1:b.voteCandidate1||'', voteCandidate2:b.voteCandidate2||'',
    votes:{0:0,1:0,2:0}, voteStopped:false, mvp:null,
    promoEmbed:b.promoEmbed||'',
    programTitle:b.programTitle||'Programul echipei noastre', programText:b.programText||'',
  };
}

app.listen(PORT, () => console.log(`✅ Server pornit pe http://localhost:${PORT}`));
