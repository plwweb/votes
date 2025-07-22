// --- กำหนดค่า Global Variables และ URL ของ GAS Web App API ---
const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzbFATSwilL9dVjqPgeMN6vsOcZmKmJaDAjfTv-5p2esWHay5POILrL1e5kFr2ru_HvNw/exec'; // <<< เปลี่ยนตรงนี้!
// ตัวอย่าง: 'https://script.google.com/macros/s/AKfycbzzzzzzzzzzzzzzzzzzzzzzzzzzzzz/exec'

let selectedDesignCode = null; // เก็บโค้ดของแบบเสื้อที่ผู้ใช้เลือก
let chartInstance = null; // เก็บ instance ของ Chart.js chart
let voterInfo = {}; // เก็บข้อมูลผู้โหวตที่กรอกในฟอร์ม

// --- Elements จาก HTML ---
const voteStatusEl = document.getElementById('vote-status');
const voterForm = document.getElementById('voter-form');
const studentIdInput = document.getElementById('studentId');
const fullNameInput = document.getElementById('fullName');
const gradeSelect = document.getElementById('grade');
const roomSelect = document.getElementById('room');
const startVoteBtn = document.getElementById('startVoteBtn');
const voteSection = document.getElementById('vote-section');
const designSelectionSection = document.getElementById('design-selection-section');
const designListContainer = document.getElementById('design-list');
const resultsChartCanvas = document.getElementById('resultsChart');

// --- Functions หลัก ---

// โหลดข้อมูลเมื่อหน้าเว็บพร้อม
document.addEventListener('DOMContentLoaded', () => {
    // กำหนดค่าห้องตามระดับชั้นเริ่มต้น (ถ้ามี)
    populateRooms(gradeSelect.value);
    // โหลดแบบเสื้อและผลโหวต
    fetchDesignsAndResults();
    // ดึงสถานะการโหวตจาก GAS และอัปเดต UI
    checkVoteStatus();

    // ตั้งเวลาให้รีเฟรชผลโหวตทุกๆ 5 วินาที
    setInterval(fetchDesignsAndResults, 5000);
    // ตั้งเวลาให้ตรวจสอบสถานะการโหวตทุกๆ 1 นาที
    setInterval(checkVoteStatus, 60000);
});

// ตรวจสอบสถานะการโหวต (เปิด/ปิด) และอัปเดต UI
async function checkVoteStatus() {
    try {
        const response = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                action: 'getSettings'
            })
        });
        const data = await response.json();

        if (data.status === 'success' && data.data) {
            const settings = data.data;
            const startTime = new Date(settings.Vote_Start_Time);
            const endTime = new Date(settings.Vote_End_Time);
            const now = new Date();

            let statusMessage = '';
            let statusClass = '';
            let enableVoting = false;

            if (now < startTime) {
                statusMessage = `การโหวตจะเปิดในวันที่ ${startTime.toLocaleDateString('th-TH')} เวลา ${startTime.toLocaleTimeString('th-TH').slice(0, 5)} น.`;
                statusClass = 'info';
                enableVoting = false;
            } else if (now > endTime) {
                statusMessage = `ระบบปิดการโหวตแล้ว ตั้งแต่ ${endTime.toLocaleDateString('th-TH')} เวลา ${endTime.toLocaleTimeString('th-TH').slice(0, 5)} น.`;
                statusClass = 'error';
                enableVoting = false;
            } else {
                statusMessage = `กำลังเปิดให้โหวต! ปิดในวันที่ ${endTime.toLocaleDateString('th-TH')} เวลา ${endTime.toLocaleTimeString('th-TH').slice(0, 5)} น.`;
                statusClass = 'success';
                enableVoting = true;
            }

            voteStatusEl.textContent = statusMessage;
            voteStatusEl.className = `status-message ${statusClass}`;
            startVoteBtn.disabled = !enableVoting; // ปิด/เปิดปุ่มเริ่มโหวตตามสถานะ
            if (!enableVoting) {
                // ถ้าปิดโหวต ให้ซ่อนส่วนเลือกแบบเสื้อ
                designSelectionSection.classList.add('hidden');
                // อาจจะแสดงข้อความเพิ่มเติมว่า "การโหวตยังไม่เปิด/ปิดแล้ว" ในส่วนนั้นด้วย
            }
        } else {
            console.error('Failed to fetch settings:', data.message);
            voteStatusEl.textContent = 'ไม่สามารถดึงสถานะการโหวตได้ โปรดลองอีกครั้ง';
            voteStatusEl.className = 'status-message error';
            startVoteBtn.disabled = true;
        }
    } catch (error) {
        console.error('Error checking vote status:', error);
        voteStatusEl.textContent = 'เกิดข้อผิดพลาดในการเชื่อมต่อ';
        voteStatusEl.className = 'status-message error';
        startVoteBtn.disabled = true;
    }
}

// จัดการการเปลี่ยนระดับชั้นเพื่อเติมห้อง
gradeSelect.addEventListener('change', (event) => {
    populateRooms(event.target.value);
});

function populateRooms(grade) {
    roomSelect.innerHTML = '<option value="">เลือกห้อง</option>'; // Clear existing options
    let numRooms = 0;
    if (grade === 'ม.1') {
        numRooms = 3;
    } else if (grade === 'ม.2') {
        numRooms = 4;
    } else if (grade === 'ม.3' || grade === 'ม.4' || grade === 'ม.5' || grade === 'ม.6') {
        numRooms = 3;
    }

    for (let i = 1; i <= numRooms; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `ห้อง ${i}`;
        roomSelect.appendChild(option);
    }
}

// ตรวจสอบข้อมูลผู้โหวตและแสดงส่วนเลือกแบบเสื้อ
voterForm.addEventListener('submit', async (event) => {
    event.preventDefault(); // ป้องกันการ Submit ฟอร์มแบบปกติ

    // รีเซ็ตข้อความสถานะ
    displayStatus('', '');

    // เก็บข้อมูลผู้โหวต
    voterInfo = {
        studentId: studentIdInput.value.trim(),
        fullName: fullNameInput.value.trim(),
        grade: gradeSelect.value,
        room: roomSelect.value
    };

    // ตรวจสอบฟอร์มเบื้องต้น (เผื่อ HTML required ไม่ทำงานหรือต้องการตรวจสอบเพิ่มเติม)
    if (!voterInfo.studentId || voterInfo.studentId.length !== 5 || !voterInfo.fullName || !voterInfo.grade || !voterInfo.room) {
        displayStatus('กรุณากรอกข้อมูลผู้โหวตให้ครบถ้วนและถูกต้อง', 'error');
        return;
    }

    try {
        const response = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                action: 'recordVote',
                studentId: voterInfo.studentId,
                fullName: voterInfo.fullName,
                grade: voterInfo.grade,
                room: voterInfo.room,
                chosenDesignCode: 'TEMP' // ส่งค่าชั่วคราวเพื่อเช็คการโหวตซ้ำและสถานะก่อน
            })
        });
        const data = await response.json();

        if (data.status === 'success' || data.code === 'DESIGN_NOT_FOUND') { // โค้ด DESIGN_NOT_FOUND แปลว่ายังไม่เคยโหวต เพราะเราส่งค่า TEMP ไป
            // ซ่อนส่วนกรอกข้อมูล
            voteSection.classList.add('hidden');
            // แสดงส่วนเลือกแบบเสื้อ
            designSelectionSection.classList.remove('hidden');
            displayStatus('กรุณาเลือกแบบเสื้อที่คุณต้องการโหวต', 'info');
            // โหลดแบบเสื้ออีกครั้งเผื่อมีการเปลี่ยนแปลงหลังจากเริ่มหน้าเว็บ
            fetchDesignsAndResults();
        } else if (data.status === 'error') {
            displayStatus(data.message, 'error');
            // ถ้าโหวตไปแล้ว หรือปิดโหวตแล้ว ไม่ต้องแสดงส่วนเลือกแบบเสื้อ
            designSelectionSection.classList.add('hidden');
        }
    } catch (error) {
        console.error('Error submitting voter info:', error);
        displayStatus('เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์', 'error');
    }
});

// ดึงข้อมูลแบบเสื้อและผลโหวตจาก GAS
async function fetchDesignsAndResults() {
    try {
        // ดึงแบบเสื้อ
        const designsResponse = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ action: 'getDesigns' })
        });
        const designsData = await designsResponse.json();

        // ดึงผลโหวต
        const resultsResponse = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ action: 'getResults' })
        });
        const resultsData = await resultsResponse.json();

        if (designsData.status === 'success' && resultsData.status === 'success') {
            renderDesignCards(designsData.data);
            updateResultsChart(resultsData.data);
        } else {
            console.error('Failed to fetch designs or results:', designsData.message, resultsData.message);
            displayStatus('ไม่สามารถโหลดข้อมูลแบบเสื้อหรือผลโหวตได้', 'error');
        }
    } catch (error) {
        console.error('Error fetching designs or results:', error);
        displayStatus('เกิดข้อผิดพลาดในการเชื่อมต่อเพื่อโหลดข้อมูล', 'error');
    }
}

// แสดงการ์ดแบบเสื้อ
function renderDesignCards(designs) {
    designListContainer.innerHTML = ''; // Clear previous designs
    designs.forEach(design => {
        const card = document.createElement('div');
        card.className = 'design-card';
        card.setAttribute('data-design-code', design['รหัสแบบเสื้อ']);
        card.innerHTML = `
            <img src="${design['URL รูปภาพ']}" alt="${design['ชื่อแบบเสื้อ']}">
            <div class="design-info">
                <h3>${design['ชื่อแบบเสื้อ']}</h3>
                <p>${design['รายละเอียด'] || 'ไม่มีรายละเอียด'}</p>
                <button class="vote-button">โหวตแบบนี้</button>
            </div>
        `;
        designListContainer.appendChild(card);

        // Add click listener to the card (or the vote button inside)
        card.querySelector('.vote-button').addEventListener('click', () => {
            selectDesign(design['รหัสแบบเสื้อ']);
        });
    });
}

// จัดการการเลือกแบบเสื้อ
function selectDesign(designCode) {
    selectedDesignCode = designCode;
    // Remove 'selected' class from all cards
    document.querySelectorAll('.design-card').forEach(card => {
        card.classList.remove('selected');
    });
    // Add 'selected' class to the chosen card
    const selected = document.querySelector(`.design-card[data-design-code="${designCode}"]`);
    if (selected) {
        selected.classList.add('selected');
    }

    // เมื่อเลือกแบบเสื้อแล้ว ให้ส่งข้อมูลโหวต
    submitVote();
}


// ส่งข้อมูลการโหวตไปยัง GAS API
async function submitVote() {
    if (!selectedDesignCode || !voterInfo.studentId) {
        displayStatus('เกิดข้อผิดพลาด: ไม่ได้เลือกแบบเสื้อหรือข้อมูลผู้โหวตไม่ครบถ้วน', 'error');
        return;
    }

    displayStatus('กำลังส่งข้อมูลโหวต...', 'info');

    try {
        const response = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                action: 'recordVote',
                studentId: voterInfo.studentId,
                fullName: voterInfo.fullName,
                grade: voterInfo.grade,
                room: voterInfo.room,
                chosenDesignCode: selectedDesignCode
            })
        });
        const data = await response.json();

        if (data.status === 'success') {
            displayStatus('โหวตสำเร็จ! ขอบคุณที่ร่วมโหวต', 'success');
            // ซ่อนส่วนเลือกแบบเสื้อ หลังจากโหวตสำเร็จ
            designSelectionSection.classList.add('hidden');
            // อาจจะแสดงปุ่ม "โหวตอีกครั้ง" หรือ "กลับหน้าแรก" ได้ถ้าต้องการ
            voterForm.reset(); // ล้างฟอร์มข้อมูลผู้โหวต
            voteSection.classList.remove('hidden'); // แสดงส่วนกรอกข้อมูลอีกครั้ง
            studentIdInput.focus(); // ตั้ง focus ไปที่รหัสนักเรียน
            selectedDesignCode = null; // รีเซ็ตค่า
            voterInfo = {}; // รีเซ็ตข้อมูลผู้โหวต
            populateRooms(''); // รีเซ็ต dropdown ห้อง
            fetchDesignsAndResults(); // อัปเดตผลโหวตทันที
        } else {
            // โค้ด ALREADY_VOTED และ VOTE_NOT_STARTED/VOTE_ENDED จะถูกจัดการจาก form submit แล้ว
            // แต่ใส่ไว้เผื่อมีการส่งซ้ำหรือสถานะเปลี่ยนระหว่างที่ยังอยู่ในหน้าโหวต
            displayStatus(data.message, 'error');
            // ถ้าโหวตไม่สำเร็จ อาจจะซ่อนส่วนเลือกแบบเสื้อและให้กลับไปกรอกข้อมูลใหม่
            designSelectionSection.classList.add('hidden');
            voteSection.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Error submitting vote:', error);
        displayStatus('เกิดข้อผิดพลาดในการเชื่อมต่อเพื่อโหวต', 'error');
    }
}

// อัปเดตกราฟผลโหวต
function updateResultsChart(results) {
    const labels = results.map(design => design.designName);
    const votes = results.map(design => design.votes);
    const backgroundColors = [
        'rgba(255, 99, 132, 0.6)', // Pinkish Red
        'rgba(54, 162, 235, 0.6)', // Blue
        'rgba(255, 206, 86, 0.6)', // Yellow
        'rgba(75, 192, 192, 0.6)', // Green
        'rgba(153, 102, 255, 0.6)',// Purple
        'rgba(255, 159, 64, 0.6)'  // Orange
    ];
    const borderColors = [
        'rgba(255, 99, 132, 1)',
        'rgba(54, 162, 235, 1)',
        'rgba(255, 206, 86, 1)',
        'rgba(75, 192, 192, 1)',
        'rgba(153, 102, 255, 1)',
        'rgba(255, 159, 64, 1)'
    ];

    if (chartInstance) {
        chartInstance.destroy(); // ทำลาย chart เก่าก่อนสร้างใหม่
    }

    const ctx = resultsChartCanvas.getContext('2d');
    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'จำนวนโหวต',
                data: votes,
                backgroundColor: backgroundColors.slice(0, labels.length),
                borderColor: borderColors.slice(0, labels.length),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) { if (value % 1 === 0) return value; }, // แสดงเฉพาะจำนวนเต็ม
                    }
                }
            },
            plugins: {
                legend: {
                    display: false // ไม่แสดง legend
                },
                title: {
                    display: true,
                    text: 'ผลคะแนนแบบเสื้อ',
                    font: { size: 18, weight: 'bold' },
                    color: '#e91e63'
                }
            }
        }
    });
}

// ฟังก์ชันแสดงข้อความสถานะ (เช่น error, success)
function displayStatus(message, type) {
    const statusEl = document.getElementById('vote-status'); // ใช้ element เดียวกับ vote-status
    statusEl.textContent = message;
    statusEl.className = `status-message ${type}`; // Add type class for styling
}
