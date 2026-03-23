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
    
    // 创建大提示弹窗（页面中央）
    var nextChapter = getNextChapter();
    var overlay = document.createElement('div');
    overlay.id = 'fq-upload-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:999998;display:flex;align-items:center;justify-content:center;';
    
    var popup = document.createElement('div');
    popup.style.cssText = 'background:white;padding:40px 60px;border-radius:16px;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,0.3);max-width:400px;';
    popup.innerHTML = '<div style="font-size:48px;margin-bottom:20px;">📚</div>' +
                      '<div style="font-size:24px;font-weight:bold;color:#333;margin-bottom:10px;">请上传第' + nextChapter + '章</div>' +
                      '<div style="font-size:14px;color:#666;margin-bottom:30px;">点击页面任意位置选择文件</div>' +
                      '<div style="font-size:12px;color:#999;">上次上传：第' + getLastChapter() + '章</div>';
    
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
    
    // 创建左下角按钮（备用）
    var btn = document.createElement('div');
    btn.textContent = '📚 第' + nextChapter + '章';
    btn.style.cssText = 'position:fixed;bottom:100px;left:20px;background:#ff6b6b;color:white;padding:12px 20px;border-radius:8px;z-index:999999;cursor:pointer;font-size:14px;font-family:sans-serif;box-shadow:0 2px 8px rgba(0,0,0,0.2);display:none;';
    document.body.appendChild(btn);
    
    var fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.md,.txt';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);
    
    // 隐藏弹窗和按钮的函数
    function hideOverlay() {
        overlay.style.display = 'none';
        btn.style.display = 'block';
    }
    
    // 触发文件选择的函数
    function triggerFileSelect() {
        hideOverlay();
        console.log('📂 打开文件选择器，请上传第' + getNextChapter() + '章');
        fileInput.click();
    }
    
    // 点击按钮选择文件
    btn.onclick = triggerFileSelect;
    
    // 点击弹窗或页面任意位置触发文件选择
    overlay.onclick = triggerFileSelect;
    
    // 等待编辑器加载
    var checkEditor = setInterval(function() {
        var editor = document.querySelector('[contenteditable="true"]');
        if (editor) {
            clearInterval(checkEditor);
            console.log('✅ 编辑器已加载，等待用户点击...');
        }
    }, 300);
    
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