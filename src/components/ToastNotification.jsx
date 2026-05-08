function ToastNotification({ notification }) {
  if (!notification) {
    return null;
  }

  return (
    <div className={`toast-notification ${notification.type}`}>
      {notification.message}
    </div>
  );
}

export default ToastNotification;
