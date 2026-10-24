const activities = [
  ['bath', 'Bath'],
  ['pajamas', 'Pajamas'],
  ['brush', 'Brush teeth'],
  ['toilet', 'Toilet'],
  ['book', 'Story time'],
  ['cuddle', 'Cuddle'],
  ['song', 'Song'],
  ['white', 'White noise'],
  ['lights', 'Lights out'],
];

const iconPaths = {
  bath: '<path d="M18 52h64v22a10 10 0 0 1-10 10H28a10 10 0 0 1-10-10V52Z" fill="#DCEEFA" stroke="#071B3D" stroke-width="5"/><path d="M25 52c1-18 49-18 50 0" fill="none" stroke="#071B3D" stroke-width="5"/><circle cx="30" cy="27" r="6" fill="#FFCC32"/><circle cx="47" cy="20" r="4" fill="#FFCC32"/><circle cx="62" cy="31" r="7" fill="#FFCC32"/>',
  pajamas: '<path d="m33 18 17 10 17-10 17 15-9 17-9-5v38H34V45l-9 5-9-17 17-15Z" fill="#DCEEFA" stroke="#071B3D" stroke-width="5" stroke-linejoin="round"/><path d="M43 26h14M50 29v53" stroke="#FFCC32" stroke-width="5" stroke-linecap="round"/>',
  brush: '<path d="M50 15C26 15 21 39 29 54c4 7 4 22 12 25 5 2 7-11 9-11s4 13 9 11c8-3 8-18 12-25 8-15 3-39-21-39Z" fill="#FFFDF8" stroke="#071B3D" stroke-width="5"/><path d="m72 20 11 11M66 26l11 11M60 32l11 11" stroke="#FFCC32" stroke-width="5" stroke-linecap="round"/>',
  toilet: '<path d="M25 18h42v25H25zM31 43h47c0 22-11 36-29 36-14 0-24-10-24-25V43Z" fill="#DCEEFA" stroke="#071B3D" stroke-width="5" stroke-linejoin="round"/><path d="M31 30h30" stroke="#FFCC32" stroke-width="5" stroke-linecap="round"/>',
  book: '<path d="M15 27c14-7 25-5 35 4v48c-11-9-22-11-35-4V27ZM85 27c-14-7-25-5-35 4v48c11-9 22-11 35-4V27Z" fill="#DCEEFA" stroke="#071B3D" stroke-width="5" stroke-linejoin="round"/><path d="m50 39 4 8 9 1-7 6 2 9-8-4-8 4 2-9-7-6 9-1 4-8Z" fill="#FFCC32"/>',
  cuddle: '<path d="M50 80S18 61 18 38c0-17 21-23 32-8 11-15 32-9 32 8 0 23-32 42-32 42Z" fill="#FFCC32" stroke="#071B3D" stroke-width="5" stroke-linejoin="round"/><path d="M38 43h1M61 43h1" stroke="#071B3D" stroke-width="6" stroke-linecap="round"/>',
  song: '<path d="M61 17v47a13 13 0 1 1-7-12V31l24-7v36a13 13 0 1 1-7-12V17H61Z" fill="#FFCC32" stroke="#071B3D" stroke-width="5" stroke-linejoin="round"/>',
  white: '<path d="M20 50h8M36 35v30M52 24v52M68 35v30M84 50h8" stroke="#071B3D" stroke-width="7" stroke-linecap="round"/><path d="M36 35v30M52 24v52M68 35v30" stroke="#FFCC32" stroke-width="3" stroke-linecap="round"/>',
  lights: '<path d="M59 18c-22 8-31 38-14 56 12 12 32 11 43-1-25 3-38-24-29-55Z" fill="#FFCC32" stroke="#071B3D" stroke-width="5" stroke-linejoin="round"/><path d="m27 24 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z" fill="#DCEEFA" stroke="#071B3D" stroke-width="3"/>',
};

const chosen = [];
const picker = document.querySelector('#picker');
const list = document.querySelector('#list');
const activityFor = (id) => activities.find(([activityId]) => activityId === id);
let draggedId = null;

function iconSvg(id) {
  return `<svg class="routine-icon" viewBox="0 0 100 100" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">${iconPaths[id]}</svg>`;
}
function iconData(id) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(iconSvg(id))}`;
}
function moveItem(fromId, toId) {
  const from = chosen.indexOf(fromId);
  const to = chosen.indexOf(toId);
  if (from < 0 || to < 0 || from === to) return;
  chosen.splice(from, 1);
  chosen.splice(to, 0, fromId);
  render();
}

function render() {
  const selected = new Set(chosen);
  picker.innerHTML = activities.map(([id, label]) => `
    <button class="sticker ${selected.has(id) ? 'selected' : ''}" data-id="${id}" aria-pressed="${selected.has(id)}">
      <span class="icon-tile">${iconSvg(id)}</span><em>${label}</em><b aria-hidden="true">✓</b>
    </button>`).join('');
  document.querySelector('#count').textContent = `${chosen.length} of 5 chosen`;
  const complete = chosen.length === 5;
  document.querySelector('#make').disabled = !complete;
  document.querySelector('#next').disabled = !complete;
  list.innerHTML = chosen.length ? chosen.map((id, index) => {
    const [, label] = activityFor(id);
    return `<li class="row" draggable="true" data-id="${id}"><span>${index + 1}</span><i class="row-icon">${iconSvg(id)}</i><strong>${label}</strong><button class="drag-handle" type="button" aria-label="Drag to reorder ${label}">⋮⋮</button></li>`;
  }).join('') : '<li class="empty">Pick five stickers to make a little routine your child can follow.</li>';
}

function showChart() {
  if (chosen.length !== 5) return;
  document.querySelector('#steps').innerHTML = chosen.map((id, index) => {
    const [, label] = activityFor(id);
    return `<article class="step"><b>${index + 1}</b><i class="step-icon">${iconSvg(id)}</i><span>${label}</span><input class="check" type="checkbox" aria-label="Mark ${label} complete"></article>`;
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
    const images = await Promise.all(chosen.map((id) => loadImage(iconData(id))));
    const canvas = document.createElement('canvas');
    canvas.width = 1200; canvas.height = 1800;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fffaf0'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#ffcc32'; ctx.lineWidth = 12; ctx.strokeRect(48, 48, 1104, 1704);
    ctx.fillStyle = '#071b3d'; ctx.textAlign = 'center';
    ctx.font = '800 30px sans-serif'; ctx.fillText('OUR BEDTIME ROUTINE', 600, 132);
    ctx.font = '800 72px sans-serif'; ctx.fillText('Our five little steps', 600, 230); ctx.fillText('before sleep.', 600, 315);
    ctx.fillStyle = '#45617b'; ctx.font = '700 25px sans-serif'; ctx.fillText('Print it to check off the steps, or cut along the dotted lines.', 600, 370);
    chosen.forEach((id, index) => {
      const [, label] = activityFor(id);
      const y = 430 + index * 245;
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#c7bbab'; ctx.lineWidth = 3; ctx.setLineDash([11, 9]);
      ctx.beginPath(); ctx.roundRect(82, y, 1036, 198, 27); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#ffcc32'; ctx.beginPath(); ctx.arc(151, y + 99, 38, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#071b3d'; ctx.font = '800 30px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(String(index + 1), 151, y + 110);
      ctx.fillStyle = '#dceefa'; ctx.beginPath(); ctx.roundRect(232, y + 25, 148, 148, 22); ctx.fill();
      ctx.drawImage(images[index], 244, y + 37, 124, 124);
      ctx.textAlign = 'left'; ctx.fillStyle = '#071b3d'; ctx.font = '800 43px sans-serif'; ctx.fillText(label, 432, y + 112);
      ctx.strokeStyle = '#071b3d'; ctx.lineWidth = 6; ctx.strokeRect(1016, y + 70, 56, 56);
    });
    const link = document.createElement('a');
    link.download = 'our-bedtime-routine.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch { window.print(); } finally {
    button.disabled = false; button.textContent = 'Save as image';
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
list.addEventListener('dragstart', (event) => {
  const row = event.target.closest('.row');
  if (!row) return;
  draggedId = row.dataset.id;
  event.dataTransfer.effectAllowed = 'move';
});
list.addEventListener('dragover', (event) => {
  const row = event.target.closest('.row');
  if (!row || !draggedId) return;
  event.preventDefault();
  list.querySelectorAll('.row').forEach((item) => item.classList.remove('drag-over'));
  row.classList.add('drag-over');
});
list.addEventListener('drop', (event) => {
  event.preventDefault();
  const row = event.target.closest('.row');
  if (row && draggedId) moveItem(draggedId, row.dataset.id);
  draggedId = null;
});
list.addEventListener('dragend', () => {
  draggedId = null;
  list.querySelectorAll('.row').forEach((item) => item.classList.remove('drag-over'));
});
list.addEventListener('pointerdown', (event) => {
  const row = event.target.closest('.row');
  if (row) draggedId = row.dataset.id;
});
list.addEventListener('pointerup', (event) => {
  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.row');
  if (draggedId && target && target.dataset.id !== draggedId) moveItem(draggedId, target.dataset.id);
  draggedId = null;
});
document.querySelector('#clear').addEventListener('click', () => { chosen.length = 0; render(); });
document.querySelector('#make').addEventListener('click', showChart);
document.querySelector('#next').addEventListener('click', showChart);
document.querySelector('#edit').addEventListener('click', (event) => {
  event.preventDefault();
  document.querySelector('#chart').hidden = true;
  document.querySelector('#builder').hidden = false;
  window.scrollTo(0, 0);
});
document.querySelector('#print').addEventListener('click', () => window.print());
document.querySelector('#png').addEventListener('click', saveChartImage);
render();