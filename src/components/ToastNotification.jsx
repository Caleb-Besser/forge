function ToastNotification({ notification, onDismiss }) {
  if (!notification) {
    return null;
  }

  return (
    <div className={`toast-notification ${notification.type}`} role="status">
      <span>{notification.message}</span>
      {notification.actionLabel && notification.onAction && (
        <button
          type="button"
          onClick={() => {
            onDismiss?.();
            notification.onAction();
          }}
        >
          {notification.actionLabel}
        </button>
      )}
    </div>
  );
}

export default ToastNotification;
