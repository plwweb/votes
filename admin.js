// --- กำหนดค่า Global Variables และ URL ของ GAS Web App API ---
const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzbFATSwilL9dVjqPgeMN6vsOcZmKmJaDAjfTv-5p2esWHay5POILrL1e5kFr2ru_HvNw/exec'; // <<< เปลี่ยนตรงนี้!

// --- Elements จาก HTML ---
const adminStatusEl = document.getElementById('admin-status');
const loginSection = document.getElementById('login-section');
const dashboardSection = document.getElementById('dashboard-section');
const loginForm = document.getElementById('login-form');
const adminUsernameInput = document.getElementById('adminUsername');
const adminPasswordInput = document.getElementById('adminPassword');
const logoutBtn = document.getElementById('logout-btn');

const voteStartTimeInput = document.getElementById('voteStartTime');
const voteEndTimeInput = document.getElementById('voteEndTime');
const saveVoteSettingsBtn = document.getElementById('saveVoteSettingsBtn');

const newDesignCodeInput = document.getElementById('newDesignCode');
const newDesignNameInput = document.getElementById('newDesignName');
const newDesignUrlInput = document.getElementById('newDesignUrl');
const newDesignDescInput = document.getElementById('newDesignDesc');
const addDesignBtn = document.getElementById('addDesignBtn');
const designTableBody = document.querySelector('#designTable tbody');

const resetVotesBtn = document.getElementById('resetVotesBtn');

let isAdminLoggedIn = false; // สถานะการล็อกอินของผู้ดูแลระบบ

// --- Functions หลัก ---

document.addEventListener('DOMContentLoaded', () => {
    // ตรวจสอบสถานะการล็อกอินเมื่อโหลดหน้า
    checkAdminLoginStatus();
    // โหลดข้อมูลแบบเสื้อและตั้งค่าการโหวตถ้าล็อกอินอยู่
    if (isAdminLoggedIn) {
        loadAdminDashboardData();
    }
});

// ตรวจสอบสถานะการล็อกอิน (ในที่นี้คือดูจาก localStorage เพื่อความง่าย)
function checkAdminLoginStatus() {
    isAdminLoggedIn = localStorage.getItem('adminLoggedIn') === 'true';
    if (isAdminLoggedIn) {
        loginSection.classList.add('hidden');
        dashboardSection.classList.remove('hidden');
        displayAdminStatus('เข้าสู่ระบบสำเร็จ', 'success');
        loadAdminDashboardData(); // โหลดข้อมูลเมื่อเข้าสู่ระบบแล้ว
    } else {
        loginSection.classList.remove('hidden');
        dashboardSection.classList.add('hidden');
        displayAdminStatus('กรุณาเข้าสู่ระบบผู้ดูแล', 'info');
    }
}

// โหลดข้อมูลสำหรับ Dashboard
async function loadAdminDashboardData() {
    if (!isAdminLoggedIn) return; // ไม่โหลดถ้าไม่ได้ล็อกอิน

    await fetchSettings();
    await fetchDesigns();
}

// --- Login / Logout ---
loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    displayAdminStatus('กำลังตรวจสอบ...', 'info');

    const username = adminUsernameInput.value.trim();
    const password = adminPasswordInput.value.trim();

    try {
        const response = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                action: 'login',
                username: username,
                password: password
            })
        });
        const data = await response.json();

        if (data.status === 'success') {
            localStorage.setItem('adminLoggedIn', 'true'); // บันทึกสถานะการล็อกอิน
            isAdminLoggedIn = true;
            checkAdminLoginStatus(); // อัปเดต UI
            displayAdminStatus('เข้าสู่ระบบสำเร็จ!', 'success');
        } else {
            displayAdminStatus(data.message, 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        displayAdminStatus('เกิดข้อผิดพลาดในการเชื่อมต่อ', 'error');
    }
});

logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('adminLoggedIn'); // ลบสถานะการล็อกอิน
    isAdminLoggedIn = false;
    checkAdminLoginStatus(); // อัปเดต UI
    displayAdminStatus('ออกจากระบบแล้ว', 'info');
    adminUsernameInput.value = ''; // ล้างฟอร์ม
    adminPasswordInput.value = '';
});

// --- การจัดการตั้งค่าการโหวต ---
async function fetchSettings() {
    if (!isAdminLoggedIn) return;
    try {
        const response = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ action: 'getSettings' })
        });
        const data = await response.json();

        if (data.status === 'success' && data.data) {
            const settings = data.data;
            // ตั้งค่าเวลาใน input type="datetime-local"
            // GAS ส่งมาเป็น ISO string, ต้องแปลงเป็น YYYY-MM-DDTHH:MM
            if (settings.Vote_Start_Time) {
                const date = new Date(settings.Vote_Start_Time);
                voteStartTimeInput.value = formatDateTimeLocal(date);
            }
            if (settings.Vote_End_Time) {
                const date = new Date(settings.Vote_End_Time);
                voteEndTimeInput.value = formatDateTimeLocal(date);
            }
        } else {
            displayAdminStatus('ไม่สามารถดึงการตั้งค่าได้: ' + data.message, 'error');
        }
    } catch (error) {
        console.error('Error fetching settings:', error);
        displayAdminStatus('เกิดข้อผิดพลาดในการโหลดการตั้งค่า', 'error');
    }
}

saveVoteSettingsBtn.addEventListener('click', async () => {
    if (!isAdminLoggedIn) {
        displayAdminStatus('กรุณาเข้าสู่ระบบ', 'error');
        return;
    }
    displayAdminStatus('กำลังบันทึกการตั้งค่า...', 'info');

    const startTime = voteStartTimeInput.value;
    const endTime = voteEndTimeInput.value;

    if (!startTime || !endTime) {
        displayAdminStatus('กรุณาระบุเวลาเปิดและปิดโหวต', 'error');
        return;
    }

    try {
        // อัปเดต Vote_Start_Time
        let response = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                action: 'updateSetting',
                adminLoggedIn: true, // ส่งสถานะการล็อกอินไปให้ GAS ตรวจสอบ
                settingName: 'Vote_Start_Time',
                newValue: startTime // ส่งเป็นรูปแบบ datetime-local string
            })
        });
        let data = await response.json();
        if (data.status !== 'success') {
            displayAdminStatus('บันทึกเวลาเปิดโหวตไม่สำเร็จ: ' + data.message, 'error');
            return;
        }

        // อัปเดต Vote_End_Time
        response = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                action: 'updateSetting',
                adminLoggedIn: true,
                settingName: 'Vote_End_Time',
                newValue: endTime // ส่งเป็นรูปแบบ datetime-local string
            })
        });
        data = await response.json();
        if (data.status === 'success') {
            displayAdminStatus('บันทึกการตั้งค่าโหวตสำเร็จ!', 'success');
        } else {
            displayAdminStatus('บันทึกเวลาปิดโหวตไม่สำเร็จ: ' + data.message, 'error');
        }

    } catch (error) {
        console.error('Error saving vote settings:', error);
        displayAdminStatus('เกิดข้อผิดพลาดในการบันทึกการตั้งค่า', 'error');
    }
});

// Helper function สำหรับฟอร์แมต Date เป็น "YYYY-MM-DDTHH:MM" สำหรับ datetime-local input
function formatDateTimeLocal(date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}


// --- การจัดการแบบเสื้อ ---
async function fetchDesigns() {
    if (!isAdminLoggedIn) return;
    try {
        const response = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ action: 'getDesigns' }) // ใช้ getDesigns เดียวกับ frontend ได้
        });
        const data = await response.json();

        if (data.status === 'success' && data.data) {
            renderDesignTable(data.data);
        } else {
            displayAdminStatus('ไม่สามารถดึงข้อมูลแบบเสื้อได้: ' + data.message, 'error');
        }
    } catch (error) {
        console.error('Error fetching designs:', error);
        displayAdminStatus('เกิดข้อผิดพลาดในการโหลดแบบเสื้อ', 'error');
    }
}

function renderDesignTable(designs) {
    designTableBody.innerHTML = ''; // Clear existing rows
    designs.forEach(design => {
        const row = designTableBody.insertRow();
        row.setAttribute('data-design-code', design['รหัสแบบเสื้อ']);
        row.innerHTML = `
            <td>${design['รหัสแบบเสื้อ']}</td>
            <td>${design['ชื่อแบบเสื้อ']}</td>
            <td><img src="${design['URL รูปภาพ']}" alt="รูป" style="width: 50px; height: 50px; object-fit: cover;"></td>
            <td>${design['รายละเอียด'] || '-'}</td>
            <td>${design['จำนวนโหวต'] || 0}</td>
            <td>
                <button class="edit-btn" data-code="${design['รหัสแบบเสื้อ']}">แก้ไข</button>
                <button class="delete-btn" data-code="${design['รหัสแบบเสื้อ']}">ลบ</button>
            </td>
        `;
    });

    // Add event listeners for edit/delete buttons
    designTableBody.querySelectorAll('.edit-btn').forEach(button => {
        button.addEventListener('click', (e) => editDesign(e.target.dataset.code));
    });
    designTableBody.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', (e) => deleteDesign(e.target.dataset.code));
    });
}

addDesignBtn.addEventListener('click', async () => {
    if (!isAdminLoggedIn) {
        displayAdminStatus('กรุณาเข้าสู่ระบบ', 'error');
        return;
    }
    displayAdminStatus('กำลังเพิ่มแบบเสื้อ...', 'info');

    const newDesign = {
        'รหัสแบบเสื้อ': newDesignCodeInput.value.trim(),
        'ชื่อแบบเสื้อ': newDesignNameInput.value.trim(),
        'URL รูปภาพ': newDesignUrlInput.value.trim(),
        'รายละเอียด': newDesignDescInput.value.trim()
    };

    if (!newDesign['รหัสแบบเสื้อ'] || !newDesign['ชื่อแบบเสื้อ'] || !newDesign['URL รูปภาพ']) {
        displayAdminStatus('กรุณากรอกรหัส, ชื่อ, และ URL รูปภาพของแบบเสื้อให้ครบถ้วน', 'error');
        return;
    }

    try {
        const response = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                action: 'addDesign',
                adminLoggedIn: true,
                design: JSON.stringify(newDesign) // ส่งเป็น JSON string
            })
        });
        const data = await response.json();

        if (data.status === 'success') {
            displayAdminStatus('เพิ่มแบบเสื้อสำเร็จ!', 'success');
            // Clear form
            newDesignCodeInput.value = '';
            newDesignNameInput.value = '';
            newDesignUrlInput.value = '';
            newDesignDescInput.value = '';
            fetchDesigns(); // รีโหลดตาราง
        } else {
            displayAdminStatus('เพิ่มแบบเสื้อไม่สำเร็จ: ' + data.message, 'error');
        }
    } catch (error) {
        console.error('Error adding design:', error);
        displayAdminStatus('เกิดข้อผิดพลาดในการเพิ่มแบบเสื้อ', 'error');
    }
});

async function editDesign(designCode) {
    if (!isAdminLoggedIn) {
        displayAdminStatus('กรุณาเข้าสู่ระบบ', 'error');
        return;
    }

    // ดึงข้อมูลแบบเสื้อทั้งหมดมาเพื่อหาอันที่จะแก้ไข
    try {
        const response = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ action: 'getDesigns' })
        });
        const data = await response.json();

        if (data.status === 'success' && data.data) {
            const designs = data.data;
            const designToEdit = designs.find(d => d['รหัสแบบเสื้อ'] === designCode);

            if (designToEdit) {
                // Prompt user for new values (simple approach for now)
                const newName = prompt(`แก้ไขชื่อแบบเสื้อ (${designToEdit['ชื่อแบบเสื้อ']}):`, designToEdit['ชื่อแบบเสื้อ']);
                const newUrl = prompt(`แก้ไข URL รูปภาพ (${designToEdit['URL รูปภาพ']}):`, designToEdit['URL รูปภาพ']);
                const newDesc = prompt(`แก้ไขรายละเอียด (${designToEdit['รายละเอียด'] || '-'}):`, designToEdit['รายละเอียด'] || '');

                if (newName !== null && newUrl !== null && newDesc !== null) { // User didn't cancel
                    displayAdminStatus('กำลังอัปเดตแบบเสื้อ...', 'info');
                    const updatedDesign = {
                        'รหัสแบบเสื้อ': designCode, // รหัสต้องไม่เปลี่ยน
                        'ชื่อแบบเสื้อ': newName,
                        'URL รูปภาพ': newUrl,
                        'รายละเอียด': newDesc
                    };

                    const updateResponse = await fetch(GAS_WEB_APP_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: new URLSearchParams({
                            action: 'updateDesign',
                            adminLoggedIn: true,
                            design: JSON.stringify(updatedDesign)
                        })
                    });
                    const updateData = await updateResponse.json();

                    if (updateData.status === 'success') {
                        displayAdminStatus('อัปเดตแบบเสื้อสำเร็จ!', 'success');
                        fetchDesigns(); // รีโหลดตาราง
                    } else {
                        displayAdminStatus('อัปเดตแบบเสื้อไม่สำเร็จ: ' + updateData.message, 'error');
                    }
                }
            } else {
                displayAdminStatus('ไม่พบแบบเสื้อที่จะแก้ไข', 'error');
            }
        } else {
            displayAdminStatus('ไม่สามารถดึงข้อมูลแบบเสื้อเพื่อแก้ไขได้', 'error');
        }
    } catch (error) {
        console.error('Error editing design:', error);
        displayAdminStatus('เกิดข้อผิดพลาดในการแก้ไขแบบเสื้อ', 'error');
    }
}

async function deleteDesign(designCode) {
    if (!isAdminLoggedIn) {
        displayAdminStatus('กรุณาเข้าสู่ระบบ', 'error');
        return;
    }

    if (confirm(`คุณแน่ใจหรือไม่ที่จะลบแบบเสื้อ "${designCode}"?`)) {
        displayAdminStatus('กำลังลบแบบเสื้อ...', 'info');
        try {
            const response = await fetch(GAS_WEB_APP_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    action: 'deleteDesign',
                    adminLoggedIn: true,
                    designCode: designCode
                })
            });
            const data = await response.json();

            if (data.status === 'success') {
                displayAdminStatus('ลบแบบเสื้อสำเร็จ!', 'success');
                fetchDesigns(); // รีโหลดตาราง
            } else {
                displayAdminStatus('ลบแบบเสื้อไม่สำเร็จ: ' + data.message, 'error');
            }
        } catch (error) {
            console.error('Error deleting design:', error);
            displayAdminStatus('เกิดข้อผิดพลาดในการลบแบบเสื้อ', 'error');
        }
    }
}

// --- รีเซ็ตข้อมูลการโหวต ---
resetVotesBtn.addEventListener('click', async () => {
    if (!isAdminLoggedIn) {
        displayAdminStatus('กรุณาเข้าสู่ระบบ', 'error');
        return;
    }

    if (confirm('คุณแน่ใจหรือไม่ที่จะรีเซ็ตข้อมูลการโหวตทั้งหมด? การดำเนินการนี้ไม่สามารถย้อนกลับได้!')) {
        displayAdminStatus('กำลังรีเซ็ตการโหวต...', 'info');
        try {
            const response = await fetch(GAS_WEB_APP_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    action: 'resetVotes',
                    adminLoggedIn: true // ส่งสถานะการล็อกอินไปให้ GAS ตรวจสอบ
                })
            });
            const data = await response.json();

            if (data.status === 'success') {
                displayAdminStatus('รีเซ็ตการโหวตทั้งหมดสำเร็จ!', 'success');
                fetchDesigns(); // รีโหลดตารางแบบเสื้อเพื่อแสดงคะแนนเป็น 0
            } else {
                displayAdminStatus('รีเซ็ตการโหวตไม่สำเร็จ: ' + data.message, 'error');
            }
        } catch (error) {
            console.error('Error resetting votes:', error);
            displayAdminStatus('เกิดข้อผิดพลาดในการรีเซ็ตการโหวต', 'error');
        }
    }
});


// --- Helper function สำหรับแสดงข้อความสถานะ ---
function displayAdminStatus(message, type) {
    adminStatusEl.textContent = message;
    adminStatusEl.className = `status-message ${type}`;
}
