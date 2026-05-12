var aiBtnState = 'idle';

function generateAIDescription(promptText) {
  if (aiBtnState === 'loading') return;
  var input = promptText ? null : document.getElementById('prod-ai-prompt');
  var prompt = promptText || (input ? input.value.trim() : '');
  if (!prompt) { showToast('Digite palavras-chave do produto', 'warning'); return; }
  aiBtnState = 'loading';
  var btn = document.getElementById('btn-gerar-ia');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;display:inline-block;margin-right:6px;vertical-align:middle"></span> Gerando...'; }
  var contentEl = document.getElementById('ai-result-content');
  if (contentEl) {
    contentEl.innerHTML = '<div style="text-align:center;padding:20px"><div class="spinner"></div><p style="margin-top:8px;color:#7A6E62">Criando descrição...</p></div>';
  }

  api.generateDescription(prompt).then(function (parsed) {
    window._aiResult = parsed;
    if (contentEl) {
      contentEl.innerHTML = '<h4 style="font-size:14px;color:#FF4500;margin-bottom:8px">Resultado da IA</h4>'
        + '<p style="font-size:14px;margin-bottom:4px"><strong>Nome Gourmet:</strong> ' + parsed.nome + '</p>'
        + '<p style="font-size:14px;margin-bottom:4px"><strong>Descrição:</strong> ' + parsed.descricao + '</p>'
        + '<p style="font-size:14px;margin-bottom:4px"><strong>Categoria:</strong> ' + parsed.categoria + '</p>';
      openModal('ai-result-modal');
    }
    aiBtnState = 'idle';
    if (btn) { btn.disabled = false; btn.textContent = 'Gerar com IA'; }
    if (!promptText) showToast('Descrição gerada com sucesso!', 'success');
    return parsed;
  }).catch(function (err) {
    if (contentEl) contentEl.innerHTML = '<p style="color:#DC2626;font-size:14px">Erro: ' + err.message + '</p>';
    aiBtnState = 'idle';
    if (btn) { btn.disabled = false; btn.textContent = 'Gerar com IA'; }
    if (!promptText) showToast('Erro ao gerar descrição: ' + err.message, 'error');
    throw err;
  });
}

function applyAIResult(field) {
  if (!window._aiResult) return;
  var r = window._aiResult;
  var nomeField = document.getElementById('prod-nome');
  var descField = document.getElementById('prod-descricao');
  var catField = document.getElementById('prod-categoria');
  if (field === 'nome' || field === 'tudo') { if (nomeField) nomeField.value = r.nome; }
  if (field === 'descricao' || field === 'tudo') { if (descField) descField.value = r.descricao; }
  if (field === 'categoria' || field === 'tudo') {
    if (catField) {
      for (var i = 0; i < catField.options.length; i++) {
        if (catField.options[i].text.toLowerCase() === r.categoria.toLowerCase()) {
          catField.value = catField.options[i].value;
          break;
        }
      }
    }
  }
  closeModal('ai-result-modal');
  showToast('Campo preenchido com sucesso!', 'success');
}

document.addEventListener('DOMContentLoaded', function () {
  var btn = document.getElementById('btn-gerar-ia');
  if (btn) {
    btn.addEventListener('click', function () { generateAIDescription(); });
  }
  var useBtn = document.getElementById('btn-use-ai-result');
  if (useBtn) {
    useBtn.addEventListener('click', function () {
      var content = document.getElementById('ai-result-content');
      var text = content ? content.textContent || content.innerText || '' : '';
      if (text && window._aiResult) {
        applyAIResult('tudo');
      } else if (text) {
        document.getElementById('prod-descricao').value = text.trim();
        closeModal('ai-result-modal');
        showToast('Descrição aplicada!', 'success');
      }
    });
  }
});
