export function createButton(label, dataset = {}) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  Object.entries(dataset).forEach(([key, value]) => {
    button.dataset[key] = value;
  });
  return button;
}

export function formatJson(value) {
  return JSON.stringify(value, null, 2);
}
