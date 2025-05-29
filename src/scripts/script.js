document.addEventListener('DOMContentLoaded', function () {
  const openBtn = document.getElementById('open-chatbot-btn')
  const modal = document.getElementById('chatbot-modal')

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
})
