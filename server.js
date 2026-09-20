const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-Memory Database
const database = {
  users: [
    { id: '1', name: 'Alice' },
    { id: '2', name: 'Bob' },
    { id: '3', name: 'Charlie' }
  ],
  projects: [
    {
      id: 'proj-1',
      name: 'Alpha Website Redesign',
      tasks: [
        {
          id: 'task-101',
          title: 'Design Landing Page',
          description: 'Create Figma mockups for desktop and mobile.',
          assignedTo: 'Alice',
          status: 'In Progress',
          comments: [
            { id: 'c1', user: 'Bob', text: 'Looks great! Make sure to use primary brand colors.' }
          ]
        }
      ]
    }
  ]
};

// --- REST API ENDPOINTS ---

// Get Users
app.get('/api/users', (req, res) => {
  res.json(database.users);
});

// Get Projects
app.get('/api/projects', (req, res) => {
  res.json(database.projects);
});

// Create Project
app.post('/api/projects', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Project name is required' });

  const newProject = { id: `proj-${Date.now()}`, name, tasks: [] };
  database.projects.push(newProject);
  io.emit('project_created', newProject);
  res.status(201).json(newProject);
});

// DELETE PROJECT
app.delete('/api/projects/:projectId', (req, res) => {
  const { projectId } = req.params;
  const index = database.projects.findIndex(p => p.id === projectId);
  
  if (index !== -1) {
    database.projects.splice(index, 1);
    io.emit('project_deleted', projectId);
    return res.status(200).json({ message: 'Project deleted successfully' });
  }
  res.status(404).json({ error: 'Project not found' });
});

// Create Task
app.post('/api/projects/:projectId/tasks', (req, res) => {
  const { projectId } = req.params;
  const { title, description, assignedTo, status } = req.body;

  const project = database.projects.find(p => p.id === projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const newTask = {
    id: `task-${Date.now()}`,
    title,
    description: description || '',
    assignedTo: assignedTo || 'Unassigned',
    status: status || 'To Do',
    comments: []
  };

  project.tasks.push(newTask);
  io.emit('task_created', { projectId, task: newTask });
  res.status(201).json(newTask);
});

// DELETE TASK
app.delete('/api/projects/:projectId/tasks/:taskId', (req, res) => {
  const { projectId, taskId } = req.params;
  const project = database.projects.find(p => p.id === projectId);
  
  if (project) {
    project.tasks = project.tasks.filter(t => t.id !== taskId);
    io.emit('task_deleted', { projectId, taskId });
    return res.status(200).json({ message: 'Task deleted successfully' });
  }
  res.status(404).json({ error: 'Project or Task not found' });
});

// Add Comment
app.post('/api/projects/:projectId/tasks/:taskId/comments', (req, res) => {
  const { projectId, taskId } = req.params;
  const { user, text } = req.body;

  const project = database.projects.find(p => p.id === projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const task = project.tasks.find(t => t.id === taskId);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const newComment = { id: `c-${Date.now()}`, user, text };
  task.comments.push(newComment);

  io.emit('comment_added', { projectId, taskId, comment: newComment });
  res.status(201).json(newComment);
});

// --- SOCKET.IO ---
io.on('connection', (socket) => {
  console.log('⚡ User connected:', socket.id);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});