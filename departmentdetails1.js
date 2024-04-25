document.addEventListener('DOMContentLoaded', function () {
    // Add event listener to the departmentSearch button
    document.getElementById('departmentSearch').addEventListener('click', function (e) {
        e.preventDefault();

        const academicYear = document.getElementById('academicYear').value;
        const department = document.getElementById('department').value;

        fetch(`/students?academicYear=${encodeURIComponent(academicYear)}&department=${encodeURIComponent(department)}`)
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    document.getElementById('studentData').innerHTML = `<p>Error: ${data.error}</p>`;
                } else {
                    let html = '<h2>Department-wise Attendance</h2>';
                    html += '<table>';
                    html += '<tr><th>Department</th><th>Presents</th><th>Absents</th><th>Check List</th></tr>';

                    // Loop through the data and create table rows
                    for (const [dept, stats] of Object.entries(data)) {
                        html += `<tr><td>${dept}</td><td>${stats.presents}</td><td>${stats.absents}</td><td><button class="checkListButton" data-department="${dept}">Check List</button></td></tr>`;
                    }

                    html += '</table>';

                    document.getElementById('studentData').innerHTML = html;

                    // Add event listeners for check list buttons
                    document.querySelectorAll('.checkListButton').forEach(button => {
                        button.addEventListener('click', function () {
                            const department = this.getAttribute('data-department');
                            // Redirect to departmentDetails.html
                            window.location.href = `/departmentDetails.html?department=${encodeURIComponent(department)}`;
                        });
                    });
                }
            })
            .catch(error => {
                console.error('Error fetching data:', error);
                document.getElementById('studentData').innerHTML = `<p>Error fetching data</p>`;
            });
    });
});
