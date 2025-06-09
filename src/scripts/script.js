document.addEventListener('DOMContentLoaded', function () {
  const openBtn = document.getElementById('open-chatbot-btn')
  const modal = document.getElementById('chatbot-modal')
  const chatForm = document.getElementById('chat-form')

  if (openBtn && modal) {
    openBtn.addEventListener('click', function () {
      modal.classList.toggle('hidden') // Toggle the 'hidden' class
    })
  }

  // Event delegation for the close button
  if (modal) {
    modal.addEventListener('click', function (e) {
      if (e.target.closest('#close-chatbot-btn')) {
        modal.classList.add('hidden') // Add the 'hidden' class to hide the modal
      }
    })
  }

  if (chatForm) {
    chatForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const input = document.getElementById('chat-input');
      if (!input || !input.value.trim()) return;
      const question = input.value.trim();
      input.value = '';
      onUserSendMessage(question);
    });

    // Handle Enter/Shift+Enter in textarea
    const input = document.getElementById('chat-input');
    if (input) {
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          chatForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }
      });
    }
  }
})

// When user submits a question:
async function onUserSendMessage(question) {
  addMessageToChat({ role: 'user', content: question });

  const response = await fetch('http://localhost:3001/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });
  const data = await response.json();

  if (data.answer) {
    addMessageToChat({ role: 'assistant', content: data.answer });
  } else {
    addMessageToChat({ role: 'assistant', content: 'Sorry, there was an error.' });
  }
}

async function createStore(pdfPath) {
  console.log('Loading PDF:', pdfPath)
  const text = await loadPDF(pdfPath)
  console.log('PDF loaded, length:', text.length)
  const chunks = splitText(text)
  console.log('Chunks:', chunks.length)
  const embeddings = await embedTexts(chunks)
  console.log('Embeddings:', embeddings.length)
  return chunks.map((c, i) => ({ text: c, embedding: embeddings[i] }))
}

async function init() {
  try {
    store = await createStore('sample.pdf')
    console.log('Store loaded')
  } catch (e) {
    console.error('Error during store creation:', e)
    process.exit(1)
  }
}
init();

function addMessageToChat({ role, content }) {
  const chatMessages = document.getElementById('chat-messages');
  if (!chatMessages) return;

  // Create message wrapper
  const wrapper = document.createElement('div');
  wrapper.className = 'mb-4 flex ' + (role === 'user' ? 'justify-end' : 'justify-start');

  // Create message bubble
  const bubble = document.createElement('div');
  bubble.className = 'max-w-[80%] rounded-lg px-4 py-2 ' +
    (role === 'user' ? 'bg-[#adb2ab] text-gray-900' : 'bg-gray-100 text-gray-900');

  // Message text
  const p = document.createElement('p');
  p.className = 'text-sm';
  p.textContent = content;

  bubble.appendChild(p);
  wrapper.appendChild(bubble);
  chatMessages.appendChild(wrapper);

  // Scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;
}
