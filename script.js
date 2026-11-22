// Load saved data from LocalStorage or initialize default sample data
let members = JSON.parse(localStorage.getItem('meat_members')) || [
    {
        id: 1,
        name: "মোঃ আব্দুল করিম (সভাপতি)",
        phone: "01711-000000",
        shares: 2,
        photo: "https://cdn-icons-png.flaticon.com/512/3135/3135715.png"
    },
    {
        id: 2,
        name: "মোঃ রহিম উদ্দিন (কোষাধ্যক্ষ)",
        phone: "01811-000000",
        shares: 1,
        photo: "https://cdn-icons-png.flaticon.com/512/3135/3135715.png"
    }
];

let transactions = JSON.parse(localStorage.getItem('meat_transactions')) || [
    {
        id: 101,
        type: "deposit",
        date: new Date().toISOString().split('T')[0],
        desc: "প্রাথমিক ফান্ড জমা - আব্দুল করিম",
        amount: 10000
    }
];

let savedNotice = localStorage.getItem('meat_notice');
if (savedNotice) {
    document.getElementById('noticeText').innerText = savedNotice;
}

// Set today's date as default in transaction form
document.getElementById('txDate').valueAsDate = new Date();

// Save to LocalStorage
function saveData() {
    localStorage.setItem('meat_members', JSON.stringify(members));
    localStorage.setItem('meat_transactions', JSON.stringify(transactions));
    renderAll();
}

// Add New Member with Local File Upload
document.getElementById('memberForm').addEventListener('submit', function(e) {
    e.preventDefault();

    const name = document.getElementById('memberName').value.trim();
    const phone = document.getElementById('memberPhone').value.trim();
    const shares = parseInt(document.getElementById('memberShares').value);
    const photoInput = document.getElementById('memberPhoto');

    const defaultAvatar = "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";

    if (photoInput.files && photoInput.files[0]) {
        const reader = new FileReader();
        reader.onload = function(event) {
            addMemberRecord(name, phone, shares, event.target.result);
        };
        reader.readAsDataURL(photoInput.files[0]);
    } else {
        addMemberRecord(name, phone, shares, defaultAvatar);
    }
});

function addMemberRecord(name, phone, shares, photoData) {
    members.push({
        id: Date.now(),
        name,
        phone,
        shares,
        photo: photoData
    });
    document.getElementById('memberForm').reset();
    document.getElementById('memberShares').value = 1;
    saveData();
}

// Delete Member
function deleteMember(id) {
    if (confirm("আপনি কি নিশ্চিতভাবে এই সদস্যকে তালিকা থেকে বাদ দিতে চান?")) {
        members = members.filter(m => m.id !== id);
        saveData();
    }
}

// Add Transaction (Deposit or Expense)
document.getElementById('transactionForm').addEventListener('submit', function(e) {
    e.preventDefault();

    const type = document.getElementById('txType').value;
    const date = document.getElementById('txDate').value;
    const desc = document.getElementById('txDesc').value.trim();
    const amount = parseFloat(document.getElementById('txAmount').value);

    transactions.unshift({
        id: Date.now(),
        type,
        date,
        desc,
        amount
    });

    document.getElementById('transactionForm').reset();
    document.getElementById('txDate').valueAsDate = new Date();
    saveData();
});

// Delete Transaction
function deleteTransaction(id) {
    if (confirm("এই হিসাবটি কি মুছে ফেলতে চান?")) {
        transactions = transactions.filter(t => t.id !== id);
        saveData();
    }
}

// Edit Notice
function editNotice() {
    const currentText = document.getElementById('noticeText').innerText;
    const newText = prompt("নতুন নোটিশ লিখুন:", currentText);
    if (newText !== null && newText.trim() !== "") {
        document.getElementById('noticeText').innerText = newText.trim();
        localStorage.setItem('meat_notice', newText.trim());
    }
}

// Search Members
document.getElementById('searchMember').addEventListener('input', function(e) {
    renderMembers(e.target.value.toLowerCase());
});

// Render Members
function renderMembers(filter = "") {
    const grid = document.getElementById('membersGrid');
    grid.innerHTML = "";

    const filtered = members.filter(m => 
        m.name.toLowerCase().includes(filter) || m.phone.includes(filter)
    );

    if (filtered.length === 0) {
        grid.innerHTML = "<p>কোনো সদস্য পাওয়া যায়নি।</p>";
        return;
    }

    filtered.forEach(member => {
        const div = document.createElement('div');
        div.className = 'member-item';
        div.innerHTML = `
            <button class="delete-member-btn no-print" onclick="deleteMember(${member.id})" title="মুছে ফেলুন">✕</button>
            <img src="${member.photo}" alt="${member.name}">
            <h4>${member.name}</h4>
            <p>📞 ${member.phone}</p>
            <span class="share-badge">শেয়ার: ${member.shares} টি</span>
        `;
        grid.appendChild(div);
    });
}

// Render Transactions & Update Dashboard
function renderAll() {
    renderMembers();

    const tbody = document.getElementById('transactionTableBody');
    tbody.innerHTML = "";

    let totalDeposit = 0;
    let totalExpense = 0;

    transactions.forEach(tx => {
        if (tx.type === 'deposit') {
            totalDeposit += tx.amount;
        } else {
            totalExpense += tx.amount;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${tx.date}</td>
            <td>${tx.desc}</td>
            <td>
                <span class="${tx.type === 'deposit' ? 'badge-deposit' : 'badge-expense'}">
                    ${tx.type === 'deposit' ? 'জমা' : 'খরচ'}
                </span>
            </td>
            <td><strong>৳ ${tx.amount.toLocaleString()}</strong></td>
            <td class="no-print">
                <button class="btn-danger-small" onclick="deleteTransaction(${tx.id})">মুছুন</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Update Summary Stats
    const totalShares = members.reduce((sum, m) => sum + m.shares, 0);
    document.getElementById('totalMembers').innerText = `${members.length} জন (${totalShares} শেয়ার)`;
    document.getElementById('totalDeposit').innerText = `৳ ${totalDeposit.toLocaleString()}`;
    document.getElementById('totalExpense').innerText = `৳ ${totalExpense.toLocaleString()}`;
    document.getElementById('currentBalance').innerText = `৳ ${(totalDeposit - totalExpense).toLocaleString()}`;
}

// Reset All Data
function resetAllData() {
    if (confirm("সতর্কতা! এতে সকল সদস্য এবং হিসাবের ডাটা মুছে যাবে। আপনি কি নিশ্চিত?")) {
        localStorage.removeItem('meat_members');
        localStorage.removeItem('meat_transactions');
        localStorage.removeItem('meat_notice');
        location.reload();
    }
}

// Initial Render
renderAll();
