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

const illustrationPaths = Object.fromEntries(activities.map(([id]) => [id, `/assets/bedtime-stickers/${id}.svg`]));

const chosen = [];
const picker = document.querySelector('#picker');
const list = document.querySelector('#list');
const activityFor = (id) => activities.find(([activityId]) => activityId === id);
let draggedId = null;

function iconIllustration(id, label = '') {
  return `<img class="routine-illustration" src="${illustrationPaths[id]}" alt="${label}">`;
}
function iconData(id) { return illustrationPaths[id]; }
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
      <span class="icon-tile">${iconIllustration(id, label)}</span><em>${label}</em><b aria-hidden="true">✓</b>
    </button>`).join('');
  document.querySelector('#count').textContent = chosen.length ? `${chosen.length} chosen` : 'Choose up to 5';
  const complete = chosen.length >= 1;
  document.querySelector('#make').disabled = !complete;
  document.querySelector('#next').disabled = !complete;
  list.innerHTML = chosen.length ? chosen.map((id, index) => {
    const [, label] = activityFor(id);
    return `<li class="row" draggable="true" data-id="${id}"><span>${index + 1}</span><i class="row-icon">${iconIllustration(id, label)}</i><strong>${label}</strong><button class="drag-handle" type="button" aria-label="Drag to reorder ${label}">⋮⋮</button></li>`;
  }).join('') : '<li class="empty">Pick one to five stickers to make a little routine your child can follow.</li>';
}

function showChart() {
  if (chosen.length < 1) return;
  document.querySelector('#steps').innerHTML = chosen.map((id, index) => {
    const [, label] = activityFor(id);
    return `<article class="step"><b>${index + 1}</b><i class="step-icon">${iconIllustration(id, label)}</i><span>${label}</span><input class="check" type="checkbox" aria-label="Mark ${label} complete"></article>`;
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
    await document.fonts.ready;
    const images = await Promise.all(chosen.map((id) => loadImage(iconData(id))));
    const canvas = document.createElement('canvas');
    canvas.width = 1200; canvas.height = 1800;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fffaf0'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#ffcc32'; ctx.lineWidth = 12; ctx.strokeRect(48, 48, 1104, 1704);
    ctx.fillStyle = '#071b3d'; ctx.textAlign = 'center';
    ctx.font = '800 30px Nunito, sans-serif'; ctx.fillText('OUR BEDTIME ROUTINE', 600, 132);
    ctx.font = '700 72px Fredoka, sans-serif'; ctx.fillText('Our five little steps', 600, 230); ctx.fillText('before sleep.', 600, 315);
    ctx.fillStyle = '#45617b'; ctx.font = '700 25px Nunito, sans-serif'; ctx.fillText('Print it to check off the steps, or cut along the dotted lines.', 600, 370);
    chosen.forEach((id, index) => {
      const [, label] = activityFor(id);
      const y = 430 + index * 245;
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#c7bbab'; ctx.lineWidth = 3; ctx.setLineDash([11, 9]);
      ctx.beginPath(); ctx.roundRect(82, y, 1036, 198, 27); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#ffcc32'; ctx.beginPath(); ctx.arc(193, y + 99, 38, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#071b3d'; ctx.font = '800 30px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(String(index + 1), 193, y + 110);
      ctx.fillStyle = '#dceefa'; ctx.beginPath(); ctx.roundRect(270, y + 25, 148, 148, 22); ctx.fill();
      ctx.drawImage(images[index], 282, y + 37, 124, 124);
      ctx.textAlign = 'left'; ctx.fillStyle = '#071b3d'; ctx.font = '700 43px Fredoka, sans-serif'; ctx.fillText(label, 470, y + 112);
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