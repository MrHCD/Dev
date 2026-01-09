// 模拟数据 (在 Joplin 插件中，这些数据将通过 joplin.data API 获取)
const mockTerms = [];

// DOM 元素引用
const pageList = document.getElementById('page-list');
const pageDetail = document.getElementById('page-detail');
const searchInput = document.getElementById('searchInput');
const termListContainer = document.getElementById('termList');
const backToListBtn = document.getElementById('backToListBtn');

const detailTermTitle = document.getElementById('detailTermTitle');
const detailTermCategory = document.getElementById('detailTermCategory');
const detailTermFull = document.getElementById('detailTermFull');
const detailTermDefinition = document.getElementById('detailTermDefinition');
const detailTermId = document.getElementById('detailTermId');


// --- 页面渲染与数据管理 ---

//渲染术语卡片
function renderTermCard(terms) {
    // ⭐ 关键：先把旧的 HTML 全部清空！
    termListContainer.innerHTML = '';
    // 然后重新生成所有卡片的 HTML
    termListContainer.innerHTML = terms.map(item => `
        <div class="term-card" data-id="${item.id}">
            <div class="term-title">${item.termAbbr}</div>
           
            <div class="term-full">
                ${item.termFull}
            </div>

            <div class="term-definition">
                ${item.termDefinition ? item.termDefinition.substring(0, 80) : '暂无定义...'}
            </div>

            <div class="term-tag">${item.termCategory}</div>
        </div>
    `).join('');

    // 为每个卡片添加点击事件监听器
    termListContainer.querySelectorAll('.term-card').forEach(card => {
        card.addEventListener('click', () => {
            const termId = card.getAttribute('data-id');
            showDetail(termId);
        });
    });
}

// 渲染术语列表
async function renderTermList(filter = "") {
    await webviewApi.postMessage({ type: 'search', query: filter }).then(response => {
        mockTerms.length = 0; // 清空当前数据
        Array.prototype.push.apply(mockTerms, response); // 更新为最新数据

        const filteredTerms = response.filter(item =>
            item.termAbbr.toLowerCase().includes(filter.toLowerCase()) ||
            item.termDefinition.toLowerCase().includes(filter.toLowerCase())
        );

        if (filteredTerms.length === 0) {
            termListContainer.innerHTML = '<div class="no-results">没有找到匹配的术语</div>';
            return;
        }

        renderTermCard(filteredTerms);
    });
}

// 显示术语详情页面
function showDetail(termId) {
    const term = mockTerms.find(item => item.id === parseInt(termId));
    if (!term) {
        console.error('未找到术语:', termId);
        // 可以显示一个错误页面或返回列表
        showList();
        return;
    }

    detailTermTitle.textContent = term.termAbbr;
    detailTermCategory.textContent = term.termCategory;
    detailTermFull.textContent = term.termFull;
    detailTermDefinition.textContent = term.termDefinition;
    detailTermId.textContent = `ID: ${term.id}`;

    pageList.style.display = 'none';
    pageDetail.style.display = 'block';
    // 隐藏滚动条，显示详情页的滚动条（如果内容很多）
    pageList.classList.remove('active');
    pageDetail.classList.add('active');
}

// 显示术语列表页面
function showList() {
    deleteConfirm = false; // 重置删除确认状态
    document.getElementById('deleteTermBtn').textContent = "删除此术语";
    document.getElementById('deleteTermBtn').style.fontWeight = "normal";
    pageDetail.style.display = 'none';
    pageList.style.display = 'flex';
    pageList.scrollTop = lastScrollPosition; // 恢复滚动位置
    // 隐藏详情页的滚动条，显示列表页的滚动条
    pageDetail.classList.remove('active');
    pageList.classList.add('active');
    // 清空搜索框，重新渲染所有术语
    searchInput.value = '';
    renderTermCard(mockTerms);
}


// --- 事件监听 ---

// 搜索输入框事件
searchInput.addEventListener('input', (e) => {
    renderTermList(e.target.value);
});

// 返回按钮事件
backToListBtn.addEventListener('click', showList);


// --- 初始化 ---
document.addEventListener('DOMContentLoaded', () => {
    // 首次加载时显示列表
    showList();
});

let currentEditId = 0; // 追踪当前正在编辑的 ID

// 打开模态框
function openModal(mode, data = {}) {

    const overlay = document.getElementById('modal-overlay');
    const title = document.getElementById('modal-title');

    if (mode === 'edit' && !data.id) {
        console.error("编辑模式下需要提供数据ID");
        return;
    }

    if (mode === 'add') {
        currentEditId = -1;
    } else {
        currentEditId = data.id;
    }

    title.textContent = mode === 'edit' ? '编辑术语' : '新增术语';

    // 填充表单
    document.getElementById('form-abbr').value = data.termAbbr || '';
    document.getElementById('form-full').value = data.termFull || '';
    document.getElementById('form-def').value = data.termDefinition || '';
    document.getElementById('form-cat').value = data.termCategory || '';

    overlay.style.display = 'flex';
}

// 关闭模态框
function closeModal() {
    document.getElementById('modal-overlay').style.display = 'none';
}

// 绑定按钮事件
document.getElementById('editTermBtn').onclick = () => {
    // 获取当前详情页展示的数据（你可以从全局变量或 DOM 属性拿）
    const data = {
        id: parseInt(document.getElementById('detailTermId').textContent.replace('ID: ', '')),
        termAbbr: document.getElementById('detailTermTitle').textContent,
        termFull: document.getElementById('detailTermFull').textContent,
        termDefinition: document.getElementById('detailTermDefinition').textContent,
        termCategory: document.getElementById('detailTermCategory').textContent
    };
    openModal('edit', data);
};

document.getElementById('addTermBtn').onclick = () => openModal('add');

document.getElementById('modal-cancel').onclick = closeModal;

// 保存逻辑
document.getElementById('modal-save').onclick = async () => {
    const formData = {
        termAbbr: document.getElementById('form-abbr').value,
        termFull: document.getElementById('form-full').value,
        termDefinition: document.getElementById('form-def').value,
        termCategory: document.getElementById('form-cat').value
    };

    const abbr = formData.termAbbr.trim();
    const full = formData.termFull.trim();
    const definition = formData.termDefinition.trim();
    const category = formData.termCategory.trim();
    if (abbr === '' || full === '' || category === '') {
        alert('请填写术语缩写、全称和类别。');
        return;
    }

    let result;
    if (currentEditId != -1) {
        // 修改逻辑
        result = await webviewApi.postMessage({
            type: 'update',
            data: { id: currentEditId, ...formData }
        });
    } else {
        // 新增逻辑
        result = await webviewApi.postMessage({
            type: 'add',
            data: { ...formData }
        });
    }

    if (result.success) {

        const idToOpen = currentEditId != -1 ? currentEditId : result.id;

        closeModal();

        // 1. 使用 await 强制等待数据更新完毕
        const response = await webviewApi.postMessage({ type: 'search', query: abbr });

        mockTerms.length = 0;
        Array.prototype.push.apply(mockTerms, response);

        // 2. 关键：更新完数组后，立即重新渲染 HTML 列表
        // 否则即使数组变了，DOM 树还是旧的
        renderTermCard(mockTerms);

        // 3. 进入详情页
        showDetail(idToOpen.toString());
    }
};

// 删除按钮确认逻辑
let deleteConfirm = false;
document.getElementById('deleteTermBtn').onclick = async function() {
    if (!deleteConfirm) {
        this.textContent = "再次点击以确认删除";
        this.style.fontWeight = "bold";
        deleteConfirm = true;
    } else {
        // 执行真正的删除逻辑
        this.textContent = "删除此术语";
        this.style.fontWeight = "normal";
        deleteConfirm = false;

        const termId = parseInt(document.getElementById('detailTermId').textContent.replace('ID: ', ''));

        const response  = await webviewApi.postMessage({ type: 'delete', id: termId });

        if(response.success ===false){
            alert("删除失败，请稍后重试。");
            return;
        }
        
        const res = await webviewApi.postMessage({ type: 'get_all' });
        if(res.success === false){
            alert("获取术语列表失败，请稍后重试。");
            return;
        }
        
        mockTerms.length = 0;
        Array.prototype.push.apply(mockTerms, res);

        renderTermCard(mockTerms);
            // 重新渲染列表
        showList();

    }
};


// 在 Joplin 环境中，你需要通过 webviewApi 进行通信
// 以下是一个示例，如果你在 Joplin 中运行，这段代码会激活
if (typeof webviewApi !== 'undefined') {
    // 假设 Joplin 后端会给你发送初始化数据
    webviewApi.postMessage({ type: 'get_initial_terms' }).then(joplinTerms => {
        // 使用 Joplin 提供的真实数据代替 mockTerms
        // const actualTerms = joplinTerms; 
        // renderTermList(actualTerms);
        console.log("Joplin 环境下，已尝试获取初始化数据。");
    });
}