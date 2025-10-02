require('dotenv').config();
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// --- Database ---
const db = new sqlite3.Database('./data.db', err => {
  if(err) console.error(err);
  else console.log("Database connected!");
});

// Create tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    email TEXT UNIQUE,
    password TEXT,
    confirmed INTEGER DEFAULT 0
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS utilities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    downloads INTEGER DEFAULT 0
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    utility_id INTEGER,
    rating INTEGER,
    review TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(utility_id) REFERENCES utilities(id)
  )`);
});

// --- Nodemailer setup ---
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

// --- Routes ---

// Sign Up
app.post('/api/signup', async (req, res) => {
  const { username, email, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  const confirmationCode = Math.random().toString(36).substring(2,8).toUpperCase();

  db.run(`INSERT INTO users (username, email, password) VALUES (?, ?, ?)`,
    [username, email, hashed],
    function(err){
      if(err) return res.status(400).json({error: err.message});

      // Send confirmation email
      transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Confirm your UsefulUtilities account',
        text: `Your confirmation code is: ${confirmationCode}`
      }, (err) => {
        if(err) return res.status(500).json({error: err.message});
        res.json({success:true, code: confirmationCode, userId: this.lastID});
      });
    }
  );
});

// Confirm account
app.post('/api/confirm', (req, res) => {
  const { userId } = req.body;
  db.run(`UPDATE users SET confirmed = 1 WHERE id = ?`, [userId], err => {
    if(err) return res.status(500).json({error: err.message});
    res.json({success:true});
  });
});

// Log In
app.post('/api/login', (req,res)=>{
  const { email, password } = req.body;
  db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err,user)=>{
    if(err) return res.status(500).json({error:err.message});
    if(!user) return res.status(400).json({error:"User not found"});
    if(!user.confirmed) return res.status(400).json({error:"Account not confirmed"});

    const match = await bcrypt.compare(password,user.password);
    if(!match) return res.status(400).json({error:"Invalid password"});
    res.json({success:true, userId:user.id, username:user.username});
  });
});

// Forgot Password
app.post('/api/recover', (req,res)=>{
  const { email } = req.body;
  const recoveryCode = Math.random().toString(36).substring(2,8).toUpperCase();
  
  transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Password Recovery - UsefulUtilities',
    text: `Your password recovery code is: ${recoveryCode}`
  }, (err)=>{
    if(err) return res.status(500).json({error: err.message});
    res.json({success:true, code: recoveryCode});
  });
});

// Increment Download
app.post('/api/download', (req,res)=>{
  const { utilityName } = req.body;
  db.run(`INSERT INTO utilities (name, downloads) VALUES (?, 1)
          ON CONFLICT(name) DO UPDATE SET downloads = downloads + 1`, [utilityName], err=>{
    if(err) return res.status(500).json({error: err.message});
    res.json({success:true});
  });
});

// Get Downloads
app.get('/api/downloads/:name', (req,res)=>{
  db.get(`SELECT downloads FROM utilities WHERE name=?`, [req.params.name], (err,row)=>{
    if(err) return res.status(500).json({error: err.message});
    res.json({downloads: row ? row.downloads : 0});
  });
});

// Submit Review
app.post('/api/review', (req,res)=>{
  const { userId, utilityName, rating, review } = req.body;

  db.get(`SELECT id FROM utilities WHERE name=?`, [utilityName], (err,row)=>{
    if(err) return res.status(500).json({error: err.message});
    const utilId = row ? row.id : null;
    if(!utilId) return res.status(400).json({error:"Utility not found"});

    db.run(`INSERT INTO reviews (user_id, utility_id, rating, review) VALUES (?,?,?,?)`,
      [userId, utilId, rating, review], err=>{
        if(err) return res.status(500).json({error: err.message});
        res.json({success:true});
      });
  });
});

// Get Reviews
app.get('/api/reviews/:utility', (req,res)=>{
  const utilityName = req.params.utility;
  db.get(`SELECT id FROM utilities WHERE name=?`, [utilityName], (err,row)=>{
    if(err) return res.status(500).json({error: err.message});
    if(!row) return res.json({reviews:[]});
    const utilId = row.id;

    db.all(`SELECT r.rating, r.review, u.username FROM reviews r 
            JOIN users u ON r.user_id = u.id WHERE utility_id=?`, [utilId], (err,rows)=>{
      if(err) return res.status(500).json({error: err.message});
      res.json({reviews: rows});
    });
  });
});

app.listen(3000,()=>console.log('Server running on port 3000'));
