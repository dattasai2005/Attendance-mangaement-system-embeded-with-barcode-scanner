const mongoose = require('mongoose');

// Define the schema for the student
const studentSchema = new mongoose.Schema({
    student: String,
    name: String,
    father_name: String,
    date_of_birth: String,
    address: String,
    contact: String,
    COURSE: String,
    BRANCH: String,
    Academic_Year: String,
    photos: [{
        data: Buffer, // Store the binary data of the photo
        contentType: String // Store the content type of the photo (e.g., image/jpeg)
    }],
    attendance: [{
        date: String,
        inTime: String,
        outTime: String,
        status: { type: String, default: 'absent' } // Default status is absent
    }]
}, { collection: 'idcard' }); // Specify the collection name

// Create and export the model
module.exports = mongoose.model('Student', studentSchema);
