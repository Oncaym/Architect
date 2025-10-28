const canvas = document.getElementById("canvas");
const roomPalette = document.getElementById("roomPalette");
const roomTemplate = document.getElementById("roomTemplate");
const paletteItemTemplate = document.getElementById("paletteItemTemplate");
const roomDetails = document.getElementById("roomDetails");
const permitChecklist = document.getElementById("permitChecklist");
const complianceContainer = document.getElementById("compliance");
const projectInputs = {
  name: document.getElementById("projectName"),
  squareFootage: document.getElementById("squareFootage"),
  floors: document.getElementById("floors"),
  bedrooms: document.getElementById("bedrooms"),
  bathrooms: document.getElementById("bathrooms"),
  style: document.getElementById("style"),
};

const scaleSelect = document.getElementById("scale");
const snapToggle = document.getElementById("snap");

const createId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `room-${Math.random().toString(16).slice(2)}`;

let state = {
  rooms: [],
  selectedRoomId: null,
  scale: Number(scaleSelect.value),
  snap: snapToggle.checked,
};

const palette = [
  { name: "Living Room", width: 18, height: 16, type: "living" },
  { name: "Kitchen", width: 14, height: 12, type: "kitchen" },
  { name: "Primary Bedroom", width: 16, height: 14, type: "bedroom" },
  { name: "Bedroom", width: 12, height: 12, type: "bedroom" },
  { name: "Bathroom", width: 8, height: 10, type: "bathroom" },
  { name: "Dining", width: 12, height: 12, type: "living" },
];

const permitRules = [
  {
    id: "egress",
    label: "Bedrooms include at least one egress window or door",
    check: (rooms) => rooms.filter((room) => room.type === "bedroom").length > 0,
  },
  {
    id: "hallway",
    label: "Hallways maintain a minimum width of 3 feet",
    check: (rooms) => rooms.every((room) => room.width >= 3 && room.height >= 3),
  },
  {
    id: "bath-access",
    label: "At least one bathroom accessible per floor",
    check: (rooms) => rooms.filter((room) => room.type === "bathroom").length >= 1,
  },
  {
    id: "kitchen",
    label: "Kitchen connected to dining/living zones",
    check: (rooms) =>
      rooms.some((room) => room.type === "kitchen") &&
      rooms.some((room) => room.type === "living"),
  },
];

const complianceLibrary = {
  modern: [
    "Energy-efficient exterior wall insulation included.",
    "Modern fenestration allowances accounted for on all facades.",
  ],
  traditional: [
    "Roof pitch satisfies neighborhood preservation requirements.",
    "Classic entry porch depth exceeds 6-foot minimum.",
  ],
  coastal: [
    "Hurricane strapping and impact-rated glazing provisions included.",
    "Raised foundation meets FEMA floodplain requirements.",
  ],
  farmhouse: [
    "Wrap-around porch structural posts spaced under 8 feet.",
    "Gable ventilation meets crossflow requirements for attics.",
  ],
};

const defaultAIConcept = () => {
  const width = 40;
  const height = 30;
  return [
    {
      name: "Living Room",
      type: "living",
      width: 18,
      height: 16,
      x: 4,
      y: 4,
    },
    { name: "Kitchen", type: "kitchen", width: 12, height: 12, x: 24, y: 4 },
    {
      name: "Dining",
      type: "living",
      width: 12,
      height: 12,
      x: 24,
      y: 18,
    },
    {
      name: "Primary Bedroom",
      type: "bedroom",
      width: 14,
      height: 14,
      x: 4,
      y: 22,
    },
    { name: "Bedroom", type: "bedroom", width: 12, height: 12, x: 20, y: 22 },
    { name: "Bathroom", type: "bathroom", width: 8, height: 10, x: 14, y: 18 },
  ].map((room) => ({ ...room, id: createId() }));
};

function renderPalette() {
  roomPalette.innerHTML = "";
  palette.forEach((item) => {
    const node = paletteItemTemplate.content.firstElementChild.cloneNode(true);
    node.textContent = `${item.name}\n${item.width}' x ${item.height}'`;
    node.addEventListener("click", () => addRoomFromPalette(item));
    roomPalette.appendChild(node);
  });
}

function addRoomFromPalette(item) {
  const room = {
    id: createId(),
    name: item.name,
    width: item.width,
    height: item.height,
    type: item.type,
    x: 10,
    y: 10,
  };
  state.rooms.push(room);
  state.selectedRoomId = room.id;
  render();
}

function addCustomRoom() {
  const name = prompt("Room name");
  if (!name) return;
  const width = Number(prompt("Width (ft)", "12"));
  const height = Number(prompt("Length (ft)", "12"));
  if (Number.isNaN(width) || Number.isNaN(height)) return;
  const room = {
    id: createId(),
    name,
    width,
    height,
    type: "custom",
    x: 10,
    y: 10,
  };
  state.rooms.push(room);
  state.selectedRoomId = room.id;
  render();
}

function renderRooms() {
  canvas.innerHTML = "";
  const scale = state.scale;
  state.rooms.forEach((room) => {
    const node = roomTemplate.content.firstElementChild.cloneNode(true);
    node.style.width = `${room.width * scale}px`;
    node.style.height = `${room.height * scale}px`;
    node.style.left = `${room.x * scale}px`;
    node.style.top = `${room.y * scale}px`;
    node.dataset.id = room.id;
    node.querySelector(".room-label").textContent = room.name;
    node.querySelector(
      ".room-dimensions"
    ).textContent = `${room.width}' x ${room.height}'`;
    if (room.id === state.selectedRoomId) {
      node.classList.add("active");
    }
    enableDrag(node, room);
    node.addEventListener("click", (event) => {
      event.stopPropagation();
      state.selectedRoomId = room.id;
      renderSidebar();
      highlightSelection();
    });
    canvas.appendChild(node);
  });
}

function enableDrag(node, room) {
  let startX = 0;
  let startY = 0;
  let originX = 0;
  let originY = 0;

  const onPointerMove = (event) => {
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    const scale = state.scale;
    let newX = originX + dx / scale;
    let newY = originY + dy / scale;
    if (state.snap) {
      newX = Math.round(newX / 2) * 2;
      newY = Math.round(newY / 2) * 2;
    }
    room.x = Math.max(0, newX);
    room.y = Math.max(0, newY);
    node.style.left = `${room.x * scale}px`;
    node.style.top = `${room.y * scale}px`;
    renderSidebar();
  };

  const onPointerUp = () => {
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);
  };

  node.addEventListener("pointerdown", (event) => {
    state.selectedRoomId = room.id;
    highlightSelection();
    renderSidebar();
    startX = event.clientX;
    startY = event.clientY;
    originX = room.x;
    originY = room.y;
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
  });
}

function highlightSelection() {
  const nodes = Array.from(canvas.querySelectorAll(".room"));
  nodes.forEach((node) => {
    if (node.dataset.id === state.selectedRoomId) {
      node.classList.add("active");
    } else {
      node.classList.remove("active");
    }
  });
}

function renderSidebar() {
  renderRoomDetails();
  renderChecklist();
  renderCompliance();
}

function renderRoomDetails() {
  const room = state.rooms.find((item) => item.id === state.selectedRoomId);
  if (!room) {
    roomDetails.innerHTML = "<p>Select a room to view details.</p>";
    return;
  }

  const area = room.width * room.height;
  const perimeter = (room.width + room.height) * 2;

  roomDetails.innerHTML = `
    <dl>
      <dt>Name</dt>
      <dd><input type="text" value="${room.name}" data-field="name" /></dd>
      <dt>Dimensions</dt>
      <dd>
        <div class="dimension-inputs">
          <label>Width (ft)<input type="number" value="${room.width}" step="0.5" data-field="width" /></label>
          <label>Length (ft)<input type="number" value="${room.height}" step="0.5" data-field="height" /></label>
        </div>
      </dd>
      <dt>Position</dt>
      <dd>${room.x.toFixed(1)}' x ${room.y.toFixed(1)}'</dd>
      <dt>Area</dt>
      <dd>${area.toFixed(1)} sq ft</dd>
      <dt>Perimeter</dt>
      <dd>${perimeter.toFixed(1)} ft</dd>
      <button class="secondary" data-action="delete">Delete Room</button>
    </dl>
  `;

  roomDetails
    .querySelector('[data-field="name"]')
    .addEventListener("input", (event) => {
      room.name = event.target.value;
      render();
    });

  roomDetails
    .querySelector('[data-field="width"]')
    .addEventListener("input", (event) => {
      const value = Number(event.target.value);
      if (!Number.isNaN(value)) {
        room.width = Math.max(4, value);
        render();
      }
    });

  roomDetails
    .querySelector('[data-field="height"]')
    .addEventListener("input", (event) => {
      const value = Number(event.target.value);
      if (!Number.isNaN(value)) {
        room.height = Math.max(4, value);
        render();
      }
    });

  roomDetails
    .querySelector('[data-action="delete"]')
    .addEventListener("click", () => {
      state.rooms = state.rooms.filter((item) => item.id !== room.id);
      state.selectedRoomId = null;
      render();
    });
}

function renderChecklist() {
  permitChecklist.innerHTML = "";
  permitRules.forEach((rule) => {
    const li = document.createElement("li");
    const status = document.createElement("span");
    status.className = "status";
    const ok = rule.check(state.rooms);
    status.classList.add(ok ? "ok" : "warn");
    const label = document.createElement("span");
    label.textContent = rule.label;
    li.append(status, label);
    permitChecklist.appendChild(li);
  });
}

function renderCompliance() {
  const style = projectInputs.style.value;
  const notes = complianceLibrary[style] || [];
  complianceContainer.innerHTML = "";
  notes.forEach((note) => {
    const div = document.createElement("div");
    div.className = "compliance-item";
    div.textContent = note;
    complianceContainer.appendChild(div);
  });

  if (state.rooms.length < 4) {
    const warning = document.createElement("div");
    warning.className = "compliance-item warn";
    warning.textContent = "Add more programmed spaces to satisfy zoning coverage minimums.";
    complianceContainer.appendChild(warning);
  }
}

function render() {
  renderRooms();
  renderSidebar();
}

function generateAIConcept() {
  const { squareFootage, bedrooms, bathrooms, style } = projectInputs;
  const totalSqft = Number(squareFootage.value) || 2200;
  const bedroomCount = Number(bedrooms.value) || 3;
  const bathroomCount = Number(bathrooms.value) || 2;
  const availableArea = totalSqft * 0.55;
  const baseRooms = defaultAIConcept();
  const scaledRooms = baseRooms.map((room) => {
    const factor = Math.sqrt(availableArea / 1200);
    return {
      ...room,
      width: Math.round(room.width * factor),
      height: Math.round(room.height * factor),
    };
  });

  const bedroomsToAdd = Math.max(0, bedroomCount - scaledRooms.filter((r) => r.type === "bedroom").length);
  for (let i = 0; i < bedroomsToAdd; i++) {
    scaledRooms.push({
      id: createId(),
      name: `Bedroom ${i + 2}`,
      type: "bedroom",
      width: 12,
      height: 12,
      x: 30,
      y: 8 + i * 14,
    });
  }

  const bathsToAdd = Math.max(0, bathroomCount - scaledRooms.filter((r) => r.type === "bathroom").length);
  for (let i = 0; i < bathsToAdd; i++) {
    scaledRooms.push({
      id: createId(),
      name: bathsToAdd > 1 ? `Bathroom ${i + 1}` : "Bathroom",
      type: "bathroom",
      width: 8,
      height: 10,
      x: 18,
      y: 8 + i * 12,
    });
  }

  state.rooms = scaledRooms;
  state.selectedRoomId = state.rooms[0]?.id ?? null;
  render();
}

function exportPlan() {
  const plan = {
    project: {
      name: projectInputs.name.value || "Untitled Residence",
      style: projectInputs.style.value,
      squareFootage: Number(projectInputs.squareFootage.value) || null,
      floors: Number(projectInputs.floors.value) || 1,
      bedrooms: Number(projectInputs.bedrooms.value) || 0,
      bathrooms: Number(projectInputs.bathrooms.value) || 0,
    },
    rooms: state.rooms,
    permitChecklist: permitRules.map((rule) => ({
      id: rule.id,
      label: rule.label,
      compliant: rule.check(state.rooms),
    })),
  };

  const blob = new Blob([JSON.stringify(plan, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${plan.project.name.replace(/\s+/g, "-").toLowerCase()}-plan.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function updateScale() {
  state.scale = Number(scaleSelect.value);
  renderRooms();
}

function updateSnap() {
  state.snap = snapToggle.checked;
}

canvas.addEventListener("click", () => {
  state.selectedRoomId = null;
  renderSidebar();
  highlightSelection();
});

scaleSelect.addEventListener("change", updateScale);
snapToggle.addEventListener("change", updateSnap);

document.getElementById("addRoom").addEventListener("click", addCustomRoom);
document.getElementById("aiGenerate").addEventListener("click", generateAIConcept);
document.getElementById("exportPlan").addEventListener("click", exportPlan);

renderPalette();
generateAIConcept();

Object.values(projectInputs).forEach((input) => {
  input.addEventListener("change", () => {
    if (state.rooms.length === 0) {
      return;
    }
    renderSidebar();
  });
});
