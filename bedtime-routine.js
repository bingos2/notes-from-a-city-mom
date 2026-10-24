const activities = [
  ['bath', 'Bath', [0, 190, 405, 292]],
  ['pajamas', 'Pajamas', [364, 30, 430, 445]],
  ['brush', 'Brush teeth', [765, 50, 410, 420]],
  ['toilet', 'Toilet', [1155, 0, 380, 465]],
  ['book', 'Book', [0, 470, 378, 335]],
  ['cuddle', 'Cuddle', [375, 470, 390, 335]],
  ['song', 'Song', [720, 470, 380, 345]],
  ['white', 'White noise', [950, 470, 335, 345]],
  ['lights', 'Lights out', [1200, 465, 336, 350]],
];

const chosen = [];
const sheet = document.querySelector('#sheet');
const images = new Map();
const picker = document.querySelector('#picker');
const list = document.querySelector('#list');
const activityFor = (id) => activities.find(([activityId]) => activityId === id);

function cropActivity(activity) {
  const [, , [x, y, width, height]] = activity;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(sheet, x, y, width, height, 0, 0, width, height);
  return canvas.toDataURL('image/png');
}

function render() {
  const selected = new Set(chosen);
  picker.innerHTML = activities.map(([id, label]) => `
    <button class="sticker ${selected.has(id) ? 'selected' : ''}" data-id="${id}" aria-pressed="${selected.has(id)}">
      <img src="${images.get(id)}" alt="${label}">
      <em>${label}</em><b aria-hidden="true">✓</b>
    </button>`).join('');

  document.querySelector('#count').textContent = `${chosen.length} of 5 chosen`;
  const complete = chosen.length === 5;
  document.querySelector('#make').disabled = !complete;
  document.querySelector('#next').disabled = !complete;

  list.innerHTML = chosen.length ? chosen.map((id, index) => {
    const [, label] = activityFor(id);
    return `<li class="row"><span>${index + 1}</span><img src="${images.get(id)}" alt=""><strong>${label}</strong>
      <button aria-label="Move ${label} earlier" data-m="-1" data-i="${index}" ${index ? '' : 'disabled'}>↑</button>
      <button aria-label="Move ${label} later" data-m="1" data-i="${index}" ${index === chosen.length - 1 ? 'disabled' : ''}>↓</button></li>`;
  }).join('') : '<li class="empty">Pick five stickers to make a little routine your child can follow.</li>';
}

function showChart() {
  if (chosen.length !== 5) return;
  document.querySelector('#steps').innerHTML = chosen.map((id, index) => {
    const [, label] = activityFor(id);
    return `<article class="step"><b>${index + 1}</b><img src="${images.get(id)}" alt="${label}"><span>${label}</span></article>`;
  }).join('');
  document.querySelector('#builder').hidden = true;
  document.querySelector('#chart').hidden = false;
  window.scrollTo(0, 0);
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

sheet.addEventListener('load', () => {
  activities.forEach((activity) => images.set(activity[0], cropActivity(activity)));
  render();
});