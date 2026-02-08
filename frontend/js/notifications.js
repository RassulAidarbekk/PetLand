class NotificationSystem {
    constructor() {
        this.container = document.getElementById('notificationContainer');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'notificationContainer';
            this.container.className = 'notification-container';
            document.body.prepend(this.container);
        }
    }

    show(options) {
        const {
            type = 'info',
            title,
            message,
            duration = 5000,
            icon = true
        } = options;

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;

        const iconHtml = icon ? `
            <div class="notification-icon">
                ${this.getIcon(type)}
            </div>
        ` : '';

        notification.innerHTML = `
            ${iconHtml}
            <div class="notification-content">
                ${title ? `<div class="notification-title">${title}</div>` : ''}
                <div class="notification-message">${message}</div>
            </div>
            <button class="notification-close" onclick="this.parentElement.classList.add('hiding')">
                &times;
            </button>
            <div class="notification-progress">
                <div class="notification-progress-bar"></div>
            </div>
        `;

        this.container.appendChild(notification);

        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
            notification.style.opacity = '1';
        }, 10);

        if (duration > 0) {
            const dismissTimeout = setTimeout(() => {
                this.dismiss(notification);
            }, duration);

            notification.addEventListener('mouseenter', () => {
                clearTimeout(dismissTimeout);
                notification.querySelector('.notification-progress-bar').style.animationPlayState = 'paused';
            });

            notification.addEventListener('mouseleave', () => {
                const remaining = duration * (notification.querySelector('.notification-progress-bar').style.width.replace('%', '') / 100);
                setTimeout(() => {
                    this.dismiss(notification);
                }, remaining);
                notification.querySelector('.notification-progress-bar').style.animationPlayState = 'running';
            });
        }

        notification.addEventListener('animationend', (e) => {
            if (e.animationName === 'slideOutRight' || notification.classList.contains('hiding')) {
                notification.remove();
            }
        });

        return notification;
    }

    getIcon(type) {
        const icons = {
            success: '✓',
            error: '✗',
            warning: '⚠',
            info: 'ℹ'
        };
        return icons[type] || icons.info;
    }

    dismiss(notification) {
        notification.classList.add('hiding');
    }

    success(message, title = 'Success', duration = 5000) {
        return this.show({ type: 'success', title, message, duration });
    }

    error(message, title = 'Error', duration = 7000) {
        return this.show({ type: 'error', title, message, duration });
    }

    warning(message, title = 'Warning', duration = 5000) {
        return this.show({ type: 'warning', title, message, duration });
    }

    info(message, title = 'Info', duration = 4000) {
        return this.show({ type: 'info', title, message, duration });
    }
}

window.notify = new NotificationSystem();
window.showNotification = (type, message, title, duration) => {
    return window.notify[type](message, title, duration);
};
