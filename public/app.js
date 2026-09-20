const socket = io();

let users = [];
let projects = [];
let activeProjectId = null;

// DOM Elements
const userSelect = document.getElementById('currentUser');
const projectList = document.getElementById('projectList');
const activeProjectTitle = document.getElementById('activeProjectTitle');
const tasksContainer = document.getElementById('tasksContainer');
const openTaskModalBtn = document.getElementById('openTaskModalBtn');
const addProjectBtn = document.getElementById('addProjectBtn');
const newProjectInput = document.getElementById('newProjectInput');

const taskModal = document.getElementById('taskModal');
const closeModal = document.getElementById('closeModal');
const createTaskForm = document.getElementById('createTaskForm');
const taskAssigneeSelect = document.getElementById('taskAssignee');

// App Initialization
async function initApp() {
  await fetchUsers();
  await fetchProjects();
}

async function fetchUsers() {
  const res = await fetch('/api/users');
  users = await res.json();
  userSelect.innerHTML = users.map(u => `<option value="${u.name}">${u.name}</option>`).join('');
  taskAssigneeSelect.innerHTML = users.map(u => `<option value="${u.name}">${u.name}</option>`).join('');
}

async function fetchProjects() {
  const res = await fetch('/api/projects');
  projects = await res.json();
  renderProjects();
}

function renderProjects() {
  projectList.innerHTML = '';
  projects.forEach(project => {
    const li = document.createElement('li');
    li.style.display = 'flex';
    li.style.justifyContent = 'space-between';
    li.style.alignItems = 'center';
    li.style.gap = '12px';
    li.className = project.id === activeProjectId ? 'active' : '';

    const nameSpan = document.createElement('span');
    nameSpan.innerText = project.name;
    nameSpan.style.flexGrow = '1';

    const deleteBtn = document.createElement('button');
    deleteBtn.innerHTML = '🗑️';
    deleteBtn.style.background = 'transparent';
    deleteBtn.style.border = 'none';
    deleteBtn.style.cursor = 'pointer';
    deleteBtn.style.fontSize = '0.9rem';
    deleteBtn.style.paddingLeft = '8px';

    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      deleteProject(project.id);
    };

    li.onclick = () => selectProject(project.id);

    li.appendChild(nameSpan);
    li.appendChild(deleteBtn);
    projectList.appendChild(li);
  });
}

async function deleteProject(projectId) {
  if (confirm('Are you sure you want to delete this project?')) {
    await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
  }
}

function selectProject(projectId) {
  activeProjectId = projectId;
  renderProjects();

  const project = projects.find(p => p.id === projectId);
  if (project) {
    activeProjectTitle.innerText = project.name;
    openTaskModalBtn.style.display = 'block';
    renderTasks(project.tasks);
  }
}

function renderTasks(tasks) {
  if (!tasks || tasks.length === 0) {
    tasksContainer.innerHTML = '<p class="placeholder-text">No tasks created yet for this project.</p>';
    return;
  }

  tasksContainer.innerHTML = tasks.map(task => `
    <div class="task-card">
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <h4>${task.title}</h4>
        <button onclick="deleteTask('${task.id}')" style="background:transparent; border:none; color:red; cursor:pointer;">🗑️</button>
      </div>
      <p>${task.description || 'No description'}</p>
      <div class="task-meta">
        <span>👤 ${task.assignedTo}</span>
        <span class="status-badge">${task.status}</span>
      </div>

      <div class="comments-section">
        <strong style="font-size: 0.8rem;">Comments (${task.comments.length}):</strong>
        <div class="comments-list">
          ${task.comments.map(c => `
            <div class="comment-item">
              <strong>${c.user}:</strong>${c.text}
            </div>
          `).join('')}
        </div>
        <div class="comment-input-group">
          <input type="text" id="comment-input-${task.id}" placeholder="Write a comment...">
          <button onclick="addComment('${task.id}')">Send</button>
        </div>
      </div>
    </div>
  `).join('');
}

async function deleteTask(taskId) {
  if (confirm('Delete this task?')) {
    await fetch(`/api/projects/${activeProjectId}/tasks/${taskId}`, { method: 'DELETE' });
  }
}

// Global Actions
addProjectBtn.onclick = async () => {
  const name = newProjectInput.value.trim();
  if (!name) return alert('Enter project name');

  await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });

  newProjectInput.value = '';
};

openTaskModalBtn.onclick = () => taskModal.style.display = 'flex';
closeModal.onclick = () => taskModal.style.display = 'none';

createTaskForm.onsubmit = async (e) => {
  e.preventDefault();
  
  const title = document.getElementById('taskTitle').value;
  const description = document.getElementById('taskDesc').value;
  const assignedTo = document.getElementById('taskAssignee').value;
  const status = document.getElementById('taskStatus').value;

  await fetch(`/api/projects/${activeProjectId}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, description, assignedTo, status })
  });

  taskModal.style.display = 'none';
  createTaskForm.reset();
};

async function addComment(taskId) {
  const input = document.getElementById(`comment-input-${taskId}`);
  const text = input.value.trim();
  const user = userSelect.value;

  if (!text) return;

  await fetch(`/api/projects/${activeProjectId}/tasks/${taskId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user, text })
  });

  input.value = '';
}

// Real-Time Socket Listeners
socket.on('project_created', (newProject) => {
  projects.push(newProject);
  renderProjects();
});

socket.on('project_deleted', (projectId) => {
  projects = projects.filter(p => p.id !== projectId);
  if (activeProjectId === projectId) {
    activeProjectId = null;
    activeProjectTitle.innerText = 'Select a Project';
    openTaskModalBtn.style.display = 'none';
    tasksContainer.innerHTML = '<p class="placeholder-text">Please select or create a project from the left menu.</p>';
  }
  renderProjects();
});

socket.on('task_created', ({ projectId, task }) => {
  const project = projects.find(p => p.id === projectId);
  if (project) {
    project.tasks.push(task);
    if (activeProjectId === projectId) {
      renderTasks(project.tasks);
    }
  }
});

socket.on('task_deleted', ({ projectId, taskId }) => {
  const project = projects.find(p => p.id === projectId);
  if (project) {
    project.tasks = project.tasks.filter(t => t.id !== taskId);
    if (activeProjectId === projectId) {
      renderTasks(project.tasks);
    }
  }
});

socket.on('comment_added', ({ projectId, taskId, comment }) => {
  const project = projects.find(p => p.id === projectId);
  if (project) {
    const task = project.tasks.find(t => t.id === taskId);
    if (task) {
      task.comments.push(comment);
      if (activeProjectId === projectId) {
        renderTasks(project.tasks);
      }
    }
  }
});

initApp();