// API URL từ Cloudflare Worker
const API_URL = 'https://ailatrieuphu.cuongprovuidulieu.workers.dev';

// Biến toàn cục
let allQuestions = [];
let askedQuestions = [];
let currentQuestion = null;
let selectedAnswer = '';
let isAnswered = false;
const MAX_LOAD = 1000; // Tăng lên 1000 câu
let isLoading = false;
let isGameStarted = false;
let isMusicMuted = false;

// Khởi tạo
document.addEventListener('DOMContentLoaded', async function() {
    await loadQuestions();
    resetUI();
    initMusic();
});

// ========== CHỨC NĂNG NHẠC NỀN ==========
function initMusic() {
    const audio = document.getElementById('bgMusic');
    const musicBtn = document.getElementById('musicBtn');
    const musicIcon = document.getElementById('musicIcon');
    
    const savedState = localStorage.getItem('music_muted');
    if (savedState === 'true') {
        audio.muted = true;
        isMusicMuted = true;
        musicBtn.classList.add('muted');
        musicIcon.textContent = '🔇';
    }
    
    document.addEventListener('click', function playOnFirstClick() {
        if (audio.paused) {
            audio.play().catch(function(error) {
                console.log('⚠️ Không thể tự động phát nhạc:', error);
            });
        }
        document.removeEventListener('click', playOnFirstClick);
    }, { once: true });
    
    audio.addEventListener('error', function(e) {
        console.log('⚠️ Lỗi phát nhạc:', e);
    });
}

// Toggle nhạc
function toggleMusic() {
    const audio = document.getElementById('bgMusic');
    const musicBtn = document.getElementById('musicBtn');
    const musicIcon = document.getElementById('musicIcon');
    
    isMusicMuted = !isMusicMuted;
    audio.muted = isMusicMuted;
    
    localStorage.setItem('music_muted', isMusicMuted);
    
    if (isMusicMuted) {
        musicBtn.classList.add('muted');
        musicIcon.textContent = '🔇';
    } else {
        musicBtn.classList.remove('muted');
        musicIcon.textContent = '🔊';
        if (audio.paused) {
            audio.play().catch(function(error) {
                console.log('⚠️ Không thể phát nhạc:', error);
            });
        }
    }
}

// ========== PHẦN CÂU HỎI ==========

// Tải câu hỏi từ Cloudflare
async function loadQuestions() {
    if (isLoading) return;
    isLoading = true;
    
    try {
        const cached = localStorage.getItem('questions_cache');
        if (cached) {
            allQuestions = JSON.parse(cached);
            console.log(`📦 Đã tải ${allQuestions.length} câu hỏi từ cache`);
            // Nếu cache ít hơn 1000, tải thêm
            if (allQuestions.length < MAX_LOAD) {
                await fetchMoreQuestions();
            }
            isLoading = false;
            return;
        }
        await fetchMoreQuestions();
    } catch (error) {
        console.error('❌ Lỗi tải câu hỏi:', error);
        const cached = localStorage.getItem('questions_cache');
        if (cached) {
            allQuestions = JSON.parse(cached);
            console.log(`📦 Đã tải ${allQuestions.length} câu hỏi từ cache (fallback)`);
        } else {
            alert('Không thể tải câu hỏi. Vui lòng kiểm tra kết nối!');
        }
    }
    isLoading = false;
}

// Tải thêm câu hỏi mới (KHÔNG TRÙNG với câu đã tải và đã hỏi)
async function fetchMoreQuestions() {
    try {
        console.log('⏳ Đang tải câu hỏi mới từ Cloudflare...');
        const response = await fetch(`${API_URL}?limit=${MAX_LOAD}`);
        if (!response.ok) throw new Error('Lỗi tải dữ liệu');
        const data = await response.json();
        
        if (data && data.length > 0) {
            // Tạo Set ID đã có (cả trong allQuestions và đã hỏi)
            const existingIds = new Set();
            
            // Thêm ID của tất cả câu đã tải trước đó
            allQuestions.forEach(q => existingIds.add(q.id));
            
            // Thêm ID của các câu đã hỏi (để đảm bảo không trùng)
            askedQuestions.forEach(item => existingIds.add(item.id));
            
            // Lọc chỉ lấy câu mới chưa có
            const newQuestions = data.filter(q => !existingIds.has(q.id));
            
            if (newQuestions.length > 0) {
                allQuestions = [...allQuestions, ...newQuestions];
                localStorage.setItem('questions_cache', JSON.stringify(allQuestions));
                console.log(`✅ Đã tải thêm ${newQuestions.length} câu hỏi mới. Tổng: ${allQuestions.length}`);
                return true;
            } else {
                console.log('⚠️ Không có câu hỏi mới nào! Có thể đã tải hết dữ liệu.');
                return false;
            }
        }
        return false;
    } catch (error) {
        console.error('❌ Lỗi tải thêm:', error);
        return false;
    }
}

// Tải lịch sử câu hỏi đã hỏi
function loadAskedHistory() {
    const stored = localStorage.getItem('asked_questions');
    if (stored) {
        try {
            askedQuestions = JSON.parse(stored);
            const fifteenDaysAgo = new Date();
            fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
            
            askedQuestions = askedQuestions.filter(item => {
                return new Date(item.timestamp) >= fifteenDaysAgo;
            });
            
            localStorage.setItem('asked_questions', JSON.stringify(askedQuestions));
        } catch (e) {
            askedQuestions = [];
        }
    } else {
        askedQuestions = [];
    }
}

// Lưu câu hỏi đã hỏi
function saveAskedQuestion(questionId) {
    askedQuestions.push({
        id: questionId,
        timestamp: new Date().toISOString()
    });
    localStorage.setItem('asked_questions', JSON.stringify(askedQuestions));
}

// Kiểm tra câu hỏi đã hỏi chưa
function isQuestionAsked(questionId) {
    return askedQuestions.some(item => item.id === questionId);
}

// Lấy câu hỏi mới chưa hỏi (có tự động tải thêm khi gần hết)
function getRandomUnaskedQuestion() {
    // Lọc những câu chưa hỏi
    const unasked = allQuestions.filter(q => !isQuestionAsked(q.id));
    
    console.log(`📊 Còn ${unasked.length} câu chưa hỏi trong tổng ${allQuestions.length} câu`);
    
    // Nếu còn ít hơn 5 câu, tự động tải thêm câu hỏi mới
    if (unasked.length <= 5 && allQuestions.length > 0) {
        console.log('⚠️ Sắp hết câu hỏi! Đang tải thêm câu hỏi mới...');
        
        // Tải thêm câu hỏi mới (bất đồng bộ, không chặn luồng)
        fetchMoreQuestions().then(success => {
            if (success) {
                console.log('✅ Đã tải thêm câu hỏi mới thành công!');
                // Nếu đang hiển thị câu hỏi "Đang tải...", không cần làm gì thêm
            } else {
                console.log('⚠️ Không thể tải thêm câu hỏi mới. Có thể đã hết dữ liệu.');
            }
        });
        
        // Vẫn trả về câu hỏi từ danh sách hiện tại (trong khi chờ tải thêm)
        if (unasked.length > 0) {
            return unasked[Math.floor(Math.random() * unasked.length)];
        }
    }
    
    // Nếu đã hỏi hết câu (unasked.length === 0)
    if (unasked.length === 0) {
        console.log('🔄 Đã hỏi hết câu, đang tải bộ câu hỏi mới...');
        
        // Reset lịch sử hỏi
        askedQuestions = [];
        localStorage.setItem('asked_questions', JSON.stringify(askedQuestions));
        
        // Tải thêm câu hỏi mới từ Cloudflare
        fetchMoreQuestions().then(success => {
            if (success) {
                console.log('✅ Đã tải bộ câu hỏi mới thành công!');
            } else {
                console.log('⚠️ Không thể tải câu hỏi mới. Vui lòng kiểm tra kết nối!');
            }
        });
        
        // Nếu vẫn còn câu trong allQuestions, lấy ngẫu nhiên (dù đã hỏi)
        if (allQuestions.length > 0) {
            return allQuestions[Math.floor(Math.random() * allQuestions.length)];
        }
        
        return null;
    }
    
    // Trả về câu hỏi ngẫu nhiên chưa hỏi
    return unasked[Math.floor(Math.random() * unasked.length)];
}

// Hiển thị câu hỏi (gọi khi bắt đầu hoặc tiếp tục)
function showNewQuestion() {
    if (allQuestions.length === 0) {
        alert('Chưa có dữ liệu câu hỏi! Vui lòng tải lại trang.');
        return;
    }
    
    loadAskedHistory();
    
    isAnswered = false;
    selectedAnswer = '';
    document.getElementById('resultModal').style.display = 'none';
    document.getElementById('confirmModal').style.display = 'none';
    
    // HIỂN THỊ CÁC NÚT A B C D
    document.getElementById('options').style.display = 'flex';
    
    currentQuestion = getRandomUnaskedQuestion();
    
    // Nếu không lấy được câu hỏi (lỗi), thử lại
    if (!currentQuestion) {
        console.log('⚠️ Không lấy được câu hỏi, thử tải lại...');
        setTimeout(() => {
            showNewQuestion();
        }, 1000);
        return;
    }
    
    document.getElementById('questionText').textContent = currentQuestion.question;
    
    const options = document.querySelectorAll('.option-btn');
    options.forEach((btn, index) => {
        const letter = btn.dataset.letter;
        const optionText = currentQuestion.options[index] || '---';
        btn.innerHTML = `<span class="letter">${letter}</span><span class="text">${optionText}</span>`;
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.borderColor = 'rgba(0, 255, 100, 0.25)';
        btn.style.background = 'linear-gradient(145deg, #1a4a1a, #0d2a0d)';
        btn.style.boxShadow = '0 6px 0 rgba(0, 50, 0, 0.8), 0 8px 20px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)';
    });
    
    saveAskedQuestion(currentQuestion.id);
    
    // Ẩn nút Bắt Đầu (vì đã có câu hỏi rồi)
    document.getElementById('startBtn').style.display = 'none';
    isGameStarted = true;
}

// Bắt đầu câu hỏi mới (lần đầu)
function startNewQuestion() {
    showNewQuestion();
}

// Hiển thị modal xác nhận
function showConfirmModal(letter) {
    if (isAnswered || !currentQuestion) return;
    
    selectedAnswer = letter;
    document.getElementById('selectedLetter').textContent = letter;
    document.getElementById('confirmModal').style.display = 'flex';
}

// Đóng modal xác nhận
function closeConfirmModal() {
    document.getElementById('confirmModal').style.display = 'none';
    selectedAnswer = '';
}

// Kiểm tra đáp án
function checkAnswer() {
    document.getElementById('confirmModal').style.display = 'none';
    isAnswered = true;
    
    const isCorrect = selectedAnswer === currentQuestion.correct;
    const resultModal = document.getElementById('resultModal');
    const resultText = document.getElementById('resultText');
    const resultDetail = document.getElementById('resultDetail');
    const resultCorrectAnswer = document.getElementById('resultCorrectAnswer');
    
    // Highlight đáp án
    document.querySelectorAll('.option-btn').forEach(btn => {
        btn.disabled = true;
        if (btn.dataset.letter === currentQuestion.correct) {
            btn.style.borderColor = '#00ff88';
            btn.style.background = 'linear-gradient(145deg, #1a6a1a, #0d4a0d)';
            btn.style.boxShadow = '0 0 30px rgba(0, 255, 136, 0.2)';
        }
        if (btn.dataset.letter === selectedAnswer && !isCorrect) {
            btn.style.borderColor = '#ff4444';
            btn.style.background = 'linear-gradient(145deg, #6a1a1a, #4a0d0d)';
            btn.style.boxShadow = '0 0 30px rgba(255, 68, 68, 0.2)';
        }
    });
    
    // Tìm đáp án đúng dạng chữ
    const letters = ['A', 'B', 'C', 'D'];
    let correctAnswerText = '';
    for (let i = 0; i < letters.length; i++) {
        if (letters[i] === currentQuestion.correct) {
            correctAnswerText = currentQuestion.options[i];
            break;
        }
    }
    
    // Hiển thị kết quả
    if (isCorrect) {
        resultText.innerHTML = `✅ Câu <span style="color:#ffd700;font-weight:bold;">${selectedAnswer}</span> Là Hoàn Toàn Chính Xác`;
        resultText.className = 'correct-text';
        resultDetail.textContent = '🎉 Chúc mừng bạn! 🎉';
    } else {
        resultText.innerHTML = `❌ Sai Nhé Bạn Ơi ❌`;
        resultText.className = 'wrong-text';
        resultDetail.textContent = '';
    }
    
    // Luôn hiển thị đáp án đúng
    resultCorrectAnswer.innerHTML = `📌 Đáp án đúng là: <span style="color:#ffd700;font-weight:bold;">${currentQuestion.correct}</span> - ${correctAnswerText}`;
    
    resultModal.style.display = 'flex';
}

// Tiếp tục chơi - TỰ ĐỘNG HIỆN CÂU HỎI MỚI
function continueGame() {
    document.getElementById('resultModal').style.display = 'none';
    
    // Reset các nút về trạng thái ban đầu
    document.querySelectorAll('.option-btn').forEach(btn => {
        btn.innerHTML = btn.dataset.letter;
        btn.disabled = true;
        btn.style.borderColor = 'rgba(0, 255, 100, 0.2)';
        btn.style.background = 'linear-gradient(145deg, #1a4a1a, #0d2a0d)';
        btn.style.boxShadow = '0 6px 0 rgba(0, 50, 0, 0.8), 0 8px 20px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)';
    });
    
    // ẨN CÁC NÚT A B C D
    document.getElementById('options').style.display = 'none';
    
    // Reset câu hỏi
    document.getElementById('questionText').textContent = 'Đang tải câu hỏi mới...';
    currentQuestion = null;
    selectedAnswer = '';
    isAnswered = false;
    
    // TỰ ĐỘNG HIỆN CÂU HỎI MỚI (không cần nhấn Bắt Đầu)
    setTimeout(() => {
        showNewQuestion();
    }, 300);
}

// Reset UI ban đầu
function resetUI() {
    document.getElementById('questionText').textContent = 'Mời Nhấn Vào "Bắt Đầu Câu Hỏi"';
    document.querySelectorAll('.option-btn').forEach(btn => {
        btn.innerHTML = btn.dataset.letter;
        btn.disabled = true;
        btn.style.borderColor = 'rgba(0, 255, 100, 0.2)';
        btn.style.background = 'linear-gradient(145deg, #1a4a1a, #0d2a0d)';
        btn.style.boxShadow = '0 6px 0 rgba(0, 50, 0, 0.8), 0 8px 20px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)';
    });
    
    // ẨN CÁC NÚT A B C D
    document.getElementById('options').style.display = 'none';
    
    // HIỂN THỊ NÚT BẮT ĐẦU
    document.getElementById('startBtn').style.display = 'block';
    document.getElementById('startBtn').disabled = false;
    document.getElementById('startBtn').style.opacity = '1';
    
    document.getElementById('confirmModal').style.display = 'none';
    document.getElementById('resultModal').style.display = 'none';
    currentQuestion = null;
    selectedAnswer = '';
    isAnswered = false;
    isGameStarted = false;
}

// Chống chuột phải
document.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    return false;
});

// Chống chọn text
document.addEventListener('selectstart', function(e) {
    e.preventDefault();
});

console.log('🔍 Game Trần Cường Khởi Động Xong!');