const activities = [
  ['bath', 'Bath', '/assets/bedtime-stickers/bath.svg'],
  ['pajamas', 'Pajamas', '/assets/bedtime-stickers/pajamas.svg'],
  ['brush', 'Brush teeth', '/assets/bedtime-stickers/brush.svg'],
  ['toilet', 'Toilet', '/assets/bedtime-stickers/toilet.svg'],
  ['book', 'Book', '/assets/bedtime-stickers/book.svg'],
  ['cuddle', 'Cuddle', '/assets/bedtime-stickers/cuddle.svg'],
  ['song', 'Song', '/assets/bedtime-stickers/song.svg'],
  ['white', 'White noise', '/assets/bedtime-stickers/white.svg'],
  ['lights', 'Lights out', '/assets/bedtime-stickers/lights.svg'],
];

const chosen = [];
const picker = document.querySelector('#picker');
const list = document.querySelector('#list');
const activityFor = (id) => activities.find(([activityId]) => activityId === id);

function render() {
  const selected = new Set(chosen);
  picker.innerHTML = activities.map(([id, label, image]) => `
    <button class="sticker ${selected.has(id) ? 'selected' : ''}" data-id="${id}" aria-pressed="${selected.has(id)}">
      <img src="${image}" alt="${label}"><em>${label}</em><b aria-hidden="true">✓</b>
    </button>`).join('');

  document.querySelector('#count').textContent = `${chosen.length} of 5 chosen`;
  const complete = chosen.length === 5;
  document.querySelector('#make').disabled = !complete;
  document.querySelector('#next').disabled = !complete;
  list.innerHTML = chosen.length ? chosen.map((id, index) => {
    const [, label, image] = activityFor(id);
    return `<li class="row"><span>${index + 1}</span><img src="${image}" alt=""><strong>${label}</strong>
      <button aria-label="Move ${label} earlier" data-m="-1" data-i="${index}" ${index ? '' : 'disabled'}>↑</button>
      <button aria-label="Move ${label} later" data-m="1" data-i="${index}" ${index === chosen.length - 1 ? 'disabled' : ''}>↓</button></li>`;
  }).join('') : '<li class="empty">Pick five stickers to make a little routine your child can follow.</li>';
}

function showChart() {
  if (chosen.length !== 5) return;
  document.querySelector('#steps').innerHTML = chosen.map((id, index) => {
    const [, label, image] = activityFor(id);
    return `<article class="step"><b>${index + 1}</b><img src="${image}" alt="${label}"><span>${label}</span></article>`;
  }).join('');
  document.querySelector('#builder').hidden = true;
  document.querySelector('#chart').hidden = false;
  window.scrollTo(0, 0);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

async function saveChartImage() {
  const button = document.querySelector('#png');
  button.disabled = true;
  button.textContent = 'Preparing image…';
  try {
    const images = await Promise.all(chosen.map((id) => loadImage(activityFor(id)[2])));
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 1650;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fffaf0';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#ffcc32';
    ctx.lineWidth = 12;
    ctx.strokeRect(48, 48, 1104, 1554);
    ctx.fillStyle = '#071b3d';
    ctx.font = '800 30px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('OUR BEDTIME ROUTINE', 600, 130);
    ctx.font = '800 72px sans-serif';
    ctx.fillText('Our five little steps', 600, 220);
    ctx.fillText('before sleep.', 600, 304);
    chosen.forEach((id, index) => {
      const [, label] = activityFor(id);
      const y = 370 + index * 224;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#e9e1d4';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.roundRect(108, y, 984, 180, 26); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffcc32';
      ctx.beginPath(); ctx.arc(112, y + 90, 34, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#071b3d';
      ctx.font = '800 28px sans-serif';
      ctx.fillText(String(index + 1), 112, y + 100);
      ctx.drawImage(images[index], 160, y + 12, 200, 156);
      ctx.textAlign = 'left';
      ctx.font = '800 40px sans-serif';
      ctx.fillText(label, 405, y + 103);
      ctx.textAlign = 'center';
    });
    ctx.fillStyle = '#45617b';
    ctx.font = '700 28px sans-serif';
    ctx.fillText('One gentle step at a time.', 600, 1540);
    const link = document.createElement('a');
    link.download = 'our-bedtime-routine.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch {
    window.print();
  } finally {
    button.disabled = false;
    button.textContent = 'Save as image';
  }
}

picker.addEventListener('click', (event) => {
  const button = event.target.closest('[data-id]');
  if (!button) return;
  const index = chosen.indexOf(button.dataset.id);
  if (index >= 0) chosen.splice(index, 1);
  else if (chosen.length < 5) chosen.push(button.dataset.id);
  render();
});
list.addEventListener('click', (event) => {
  const button = event.target.closest('[data-m]');
  if (!button) return;
  const index = Number(button.dataset.i);
  const nextIndex = index + Number(button.dataset.m);
  [chosen[index], chosen[nextIndex]] = [chosen[nextIndex], chosen[index]];
  render();
});
document.querySelector('#clear').addEventListener('click', () => { chosen.length = 0; render(); });
document.querySelector('#make').addEventListener('click', showChart);
document.querySelector('#next').addEventListener('click', showChart);
document.querySelector('#edit').addEventListener('click', () => {
  document.querySelector('#chart').hidden = true;
  document.querySelector('#builder').hidden = false;
  window.scrollTo(0, 0);
});
document.querySelector('#print').addEventListener('click', () => window.print());
document.querySelector('#png').addEventListener('click', saveChartImage);
render();