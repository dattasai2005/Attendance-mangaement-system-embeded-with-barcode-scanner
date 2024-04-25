const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const path = require('path');
const cron = require('node-cron');
const Student = require('./student');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/idcard')
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('Could not connect to MongoDB', err));

// Middleware for parsing JSON bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Add endpoint to serve photos
app.get('/student/photo/:id', async (req, res) => {
    const studentId = req.params.id;

    try {
        const student = await Student.findById(studentId);

        if (!student) {
            return res.status(404).send('Student not found');
        }

        // Assuming the first photo is retrieved
        const firstPhoto = student.photos[0];

        // Set the content type header
        res.contentType(firstPhoto.contentType);

        // Send the photo data
        res.send(firstPhoto.data);
    } catch (error) {
        console.error('Error retrieving photo:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Route to retrieve photo for a specific student by ID
app.get('/photos/:id', async (req, res) => {
    try {
        const studentId = req.params.id;
        const student = await Student.findOne({ student: studentId });

        if (!student || !student.photos || student.photos.length === 0) {
            return res.status(404).send('Photo not found');
        }

        const photo = student.photos[0];

        res.set('Content-Type', photo.contentType);
        res.send(photo.data);
    } catch (error) {
        console.error('Error retrieving photo:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Add endpoint to calculate attendance percentage for a student
app.get('/student/attendance/:id', async (req, res) => {
    const studentId = req.params.id;

    try {
        const student = await Student.findById(studentId);
        if (!student) {
            return res.status(404).send('Student not found');
        }

        // Calculate attendance percentage
        const totalDays = student.attendance.length;
        const presentDays = student.attendance.filter(entry => entry.status === 'present').length;
        const attendancePercentage = (presentDays / totalDays) * 100;

        res.json({ attendancePercentage });
    } catch (error) {
        console.error('Error calculating attendance percentage:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Define a function to create attendance entries for today if they don't exist
async function createAttendanceEntries() {
    try {
        const students = await Student.find();
        const today = new Date().toISOString().slice(0, 10);

        for (const student of students) {
            // Check if attendance entry already exists for today
            const attendanceEntry = student.attendance.find(entry => entry.date === today);
            if (!attendanceEntry) {
                // If no attendance entry exists for today, create one with default values
                student.attendance.push({
                    date: today,
                    status: 'absent' // Default status is absent
                });
                await student.save();
            }
        }
        console.log('Attendance entries created for today:', today);
    } catch (error) {
        console.error('Error creating attendance entries:', error);
    }
}

// Define the cron job to generate attendance entries
cron.schedule('0 0 * * *', async () => {
    await createAttendanceEntries(); // Call the function to create entries
});

// Immediately invoke the function when the server starts
createAttendanceEntries().catch(err => console.error('Error creating attendance entries:', err));

// Route for marking attendance
app.post('/mark-attendance', async (req, res) => {
    const { studentId } = req.body;
    console.log('Received studentId:', studentId);

    try {
        const student = await Student.findOne({ student: studentId });
        if (!student) return res.status(404).send('Student not found');

        const today = new Date().toISOString().slice(0, 10);
        const attendanceEntry = student.attendance.find(entry => entry.date === today);
        
        if (attendanceEntry) {
            attendanceEntry.status = 'present';
            await student.save();

            // Include photo data in the response
            const responseData = {
                student: {
                    name: student.name,
                    studentId: student._id,
                    photos: student.photos, // Include photos array
                    course: student.COURSE,
                    branch: student.BRANCH
                }
            };
            res.json({ message: 'Attendance marked successfully', student: responseData.student });
        } else {
            res.status(400).send('Attendance entry for today does not exist');
        }
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

// Route to retrieve student information by ID
app.get('/api/student/:id', async (req, res) => {
  try {
    const studentId = req.params.id;
    const student = await Student.findOne({ student: studentId });

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    res.json(student);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// API endpoint to fetch department-wise attendance stats
app.get('/students', async (req, res) => {
    try {
        const academicYear = req.query.academicYear;
        const department = req.query.department;

        let query = {};

        if (academicYear !== 'all') {
            query.Academic_Year = academicYear;
        }

        if (department !== 'all') {
            query.BRANCH = department;
        }

        const todayDate = new Date().toISOString().slice(0, 10);

        const attendanceStats = await Student.aggregate([
            { $match: query },
            { $unwind: '$attendance' },
            { $match: { 'attendance.date': todayDate } },
            {
                $group: {
                    _id: '$BRANCH',
                    presents: { $sum: { $cond: [{ $eq: ['$attendance.status', 'present'] }, 1, 0] } },
                    absents: { $sum: { $cond: [{ $eq: ['$attendance.status', 'absent'] }, 1, 0] } }
                }
            }
        ]);

        const result = {};
        attendanceStats.forEach(entry => {
            result[entry._id] = { presents: entry.presents, absents: entry.absents };
        });

        res.json(result);
    } catch (err) {
        console.error('Error fetching attendance data:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Default route to serve the departmentDetails.html page
app.get('/departmentDetails.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'departmentDetails.html'));
});

// API endpoint to fetch individual student details by department
app.get('/api/student/:department', async (req, res) => {
    try {
        const department = req.params.department;
        const students = await Student.find({ BRANCH: department });

        if (!students || students.length === 0) {
            return res.status(404).json({ error: 'No students found for the department' });
        }

        res.json(students);
    } catch (error) {
        console.error('Error fetching student details:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// API endpoint to fetch student details by department
app.get('/api/studentsByDepartment', async (req, res) => {
    try {
        const department = req.query.department;

        if (!department) {
            return res.status(400).json({ error: 'Department parameter is missing' });
        }

        const students = await Student.find({ BRANCH: department });

        if (!students || students.length === 0) {
            return res.status(404).json({ error: 'No students found for the department' });
        }

        res.json(students);
    } catch (error) {
        console.error('Error fetching student details by department:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Define API endpoint to fetch student details by department with today's attendance and percentage
app.get('/api/studentsByDepartmentWithAttendance', async (req, res) => {
    try {
        const department = req.query.department;

        if (!department) {
            return res.status(400).json({ error: 'Department parameter is missing' });
        }

        // Get today's date
        const today = new Date().toISOString().split('T')[0];

        // Find students for the provided department
        const students = await Student.find({ BRANCH: department });

        if (!students || students.length === 0) {
            return res.status(404).json({ error: 'No students found for the department' });
        }

        // Prepare student details with today's attendance and percentage
        const studentsWithAttendance = students.map(student => {
            const todayAttendance = student.attendance.find(entry => entry.date === today);
            const attendanceStatus = todayAttendance ? todayAttendance.status : 'Absent';
            
            // Calculate attendance percentage
            const totalDays = student.attendance.length;
            const presentDays = student.attendance.filter(entry => entry.status === 'present').length;
            const percentage = totalDays === 0 ? 0 : (presentDays / totalDays) * 100;

            return {
                student: student.student,
                name: student.name,
                BRANCH: student.BRANCH,
                father_name: student.father_name,
                contact: student.contact,
                Attendence: attendanceStatus,
                Percentage: percentage
            };
        });

        res.json(studentsWithAttendance);
    } catch (error) {
        console.error('Error fetching student details by department with attendance:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Default route to serve the frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'departmentdetails1.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});


