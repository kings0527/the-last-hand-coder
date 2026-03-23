// ==UserScript==
// @name         番茄小说发布工具
// @namespace    http://tampermonkey.net/
// @version      6.5
// @description  自动填写章节内容并提交，自动记录章节序号
// @author       OpenClaw
// @match        *://fanqienovel.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    
    if (!location.href.includes('/publish')) return;
    
    console.log('📚 番茄小说发布工具 v6.5');
    
    // 获取/设置上次上传的章节号
    function getLastChapter() {
        var last = localStorage.getItem('fanqie_last_chapter');
        return last ? parseInt(last) : 0;
    }
    
    function setLastChapter(num) {
        localStorage.setItem('fanqie_last_chapter', num);
        console.log('💾 已记录章节号:', num);
    }
    
    // 获取下一个应该上传的章节号
    function getNextChapter() {
        var last = getLastChapter();
        return last + 1;
    }
    
    // 延时函数
    function sleep(ms) {
        return new Promise(function(resolve) { setTimeout(resolve, ms); });
    }
    
    // 点击包含指定文本的按钮
    function clickButton(text) {
        var buttons = document.querySelectorAll('button');
        for (var i = 0; i < buttons.length; i++) {
            if (buttons[i].textContent.includes(text)) {
                buttons[i].click();
                console.log('✅ 点击按钮: ' + text);
                return true;
            }
        }
        return false;
    }
    
    // 点击弹窗的确定/确认按钮
    function clickModalConfirm() {
        // 先找 arco-btn-primary
        var primaryBtns = document.querySelectorAll('.arco-btn-primary');
        for (var i = 0; i < primaryBtns.length; i++) {
            var btnText = primaryBtns[i].textContent.trim();
            if (btnText == '提交' || btnText === '确定' || btnText === '确认发布' || btnText === '确认提交') {
                primaryBtns[i].click();
                console.log('✅ 点击弹窗: ' + btnText);
                return true;
            }
        }
        // 再找普通 button
        var buttons = document.querySelectorAll('button');
        for (var i = 0; i < buttons.length; i++) {
            var btnText = buttons[i].textContent.trim();
            if (btnText == '提交' || btnText === '确定' || btnText === '确认发布' || btnText === '确认提交') {
                buttons[i].click();
                console.log('✅ 点击按钮: ' + btnText);
                return true;
            }
        }
        return false;
    }
    
    // 选择"是否使用AI：是"
    function selectUseAI() {
        var radios = document.querySelectorAll('.arco-radio');
        for (var i = 0; i < radios.length; i++) {
            if (radios[i].textContent.includes('是')) {
                var input = radios[i].querySelector('input');
                if (input && !input.checked) {
                    input.click();
                    console.log('✅ 选择使用AI: 是');
                    return true;
                }
            }
        }
        return false;
    }
    
    // 创建按钮（显示下次应该上传的章节）
    var btn = document.createElement('div');
    var nextChapter = getNextChapter();
    btn.textContent = '📚 请上传第' + nextChapter + '章';
    btn.style.cssText = 'position:fixed;bottom:100px;left:20px;background:#ff6b6b;color:white;padding:12px 20px;border-radius:8px;z-index:999999;cursor:pointer;font-size:14px;font-family:sans-serif;box-shadow:0 2px 8px rgba(0,0,0,0.2);';
    
    // 添加脉冲动画样式
    var style = document.createElement('style');
    style.textContent = '@keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.05); } }';
    document.head.appendChild(style);
    document.body.appendChild(btn);
    
    var fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.md,.txt';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);
    
    // 点击按钮选择文件
    btn.onclick = function() { fileInput.click(); };
    
    // 页面加载后自动弹出文件选择器（适用于所有发布页面）
    var autoPopupTriggered = false;
    var pendingAutoPopup = false;
    
    // 尝试自动弹出的函数
    function tryAutoPopup() {
        if (autoPopupTriggered) return false;
        var editor = document.querySelector('[contenteditable="true"]');
        if (editor) {
            autoPopupTriggered = true;
            console.log('✅ 编辑器已加载');
            console.log('📄 自动弹出文件选择器，请上传第' + getNextChapter() + '章');
            fileInput.click();
            return true;
        }
        return false;
    }
    
    // 1. 等待编辑器加载后自动弹出
    var checkEditor = setInterval(function() {
        if (tryAutoPopup()) {
            clearInterval(checkEditor);
        }
    }, 300);
    
    // 2. 浏览器可能阻止自动弹出，监听首次点击页面任意位置后触发
    function onFirstClick() {
        if (!autoPopupTriggered) {
            console.log('👆 检测到点击，尝试弹出文件选择器');
            if (tryAutoPopup()) {
                clearInterval(checkEditor);
            }
        }
        document.removeEventListener('click', onFirstClick);
    }
    document.addEventListener('click', onFirstClick);
    
    // 3. 3秒后如果还没弹出，显示提示让用户点击按钮
    setTimeout(function() {
        if (!autoPopupTriggered) {
            console.log('⏰ 自动弹出被阻止，请手动点击按钮选择文件');
            btn.style.background = '#faad14';
            btn.textContent = '👆 点击上传第' + getNextChapter() + '章';
            btn.style.animation = 'pulse 1s infinite';
        }
    }, 3000);
    
    fileInput.onchange = function(e) {
        var file = e.target.files[0];
        if (!file) return;
        
        btn.textContent = '📖 处理中...';
        
        var reader = new FileReader();
        reader.onload = async function(ev) {
            try {
                var text = ev.target.result;
                var lines = text.trim().split('\n');
                var firstLine = lines[0].replace(/^#\s*/, '').trim();
                
                var m = firstLine.match(/第(\d+)章/);
                var chapter = m ? m[1] : '';
                var title = firstLine.replace(/第\d+章\s*/, '').trim();
                var content = lines.slice(1).join('\n').trim();
                
                // 验证章节号是否与预期一致
                var expectedChapter = getNextChapter();
                if (chapter && parseInt(chapter) !== expectedChapter) {
                    var confirmed = confirm('⚠️ 警告：您上传的是第' + chapter + '章，但上次上传的是第' + getLastChapter() + '章。\n\n是否继续上传第' + chapter + '章？\n\n点击"确定"继续上传，点击"取消"停止。');
                    if (!confirmed) {
                        btn.textContent = '📚 已取消，请上传第' + expectedChapter + '章';
                        return;
                    }
                }
                
                // 1. 填写章节号
                var input0 = document.querySelectorAll('input')[0];
                input0.focus();
                Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input0, chapter);
                input0.dispatchEvent(new Event('input', {bubbles:true}));
                
                // 2. 填写标题
                var input1 = document.querySelectorAll('input')[1];
                input1.focus();
                Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input1, title);
                input1.dispatchEvent(new Event('input', {bubbles:true}));
                
                // 3. 填写正文
                var editor = document.querySelector('[contenteditable="true"]');
                editor.focus();
                var paras = content.split('\n\n').filter(function(p) { return p.trim(); });
                editor.innerHTML = paras.map(function(p) { return '<p>' + p.trim() + '</p>'; }).join('');
                editor.dispatchEvent(new Event('input', {bubbles:true}));
                
                btn.textContent = '✅ 已填写';
                console.log('✅ 表单已填写: 第' + chapter + '章');
                
                await sleep(800);
                
                // 4. 点击下一步
                btn.textContent = '⏳ 下一步...';
                clickButton('下一步');
                
                await sleep(2000);
                
                // 5. 循环处理所有弹窗
                btn.textContent = '⏳ 发布中...';
                
                var published = false;
                var attempts = 0;
                var maxAttempts = 30;
                
                while (!published && attempts < maxAttempts) {
                    attempts++;
                    await sleep(500);
                    
                    // 点击确定/确认按钮
                    clickModalConfirm();
                    
                    // 选择使用AI
                    selectUseAI();
                    
                    // 点击确认发布
                    clickButton('确认发布');
                    
                    // 检查是否完成
                    if (location.href.includes('chapter-manage')) {
                        published = true;
                    }
                }
                
                if (published) {
                    // 记录成功的章节号
                    if (chapter) {
                        setLastChapter(parseInt(chapter));
                    }
                    btn.textContent = '✅ 第' + chapter + '章发布成功';
                    btn.style.background = '#52c41a';
                    console.log('🎉 第' + chapter + '章发布完成');
                } else {
                    btn.textContent = '⚠️ 请手动完成';
                    btn.style.background = '#faad14';
                }
                
            } catch (err) {
                console.error('❌ 出错:', err);
                btn.textContent = '❌ 出错了';
                btn.style.background = '#ff4d4f';
            }
        };
        reader.readAsText(file, 'UTF-8');
        fileInput.value = '';
    };
    
})();