// ============================================================
// Input Manager - Mouse, Touch, and Keyboard input
// ============================================================

export class InputManager {
  targetAngle: number = 0;
  boosting: boolean = false;

  private canvas: HTMLCanvasElement;
  private centerX: number = 0;
  private centerY: number = 0;
  private isMobile: boolean = false;
  private mobileBoostBtn: HTMLElement | null = null;
  private touchId: number | null = null;
  private touchX: number = 0;
  private touchY: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this.updateCenter();
    this.setupListeners();
  }

  private updateCenter(): void {
    this.centerX = window.innerWidth / 2;
    this.centerY = window.innerHeight / 2;
  }

  private setupListeners(): void {
    // Mouse
    window.addEventListener('mousemove', (e) => {
      this.updateCenter();
      const dx = e.clientX - this.centerX;
      const dy = e.clientY - this.centerY;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        this.targetAngle = Math.atan2(dy, dx);
      }
    });

    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.boosting = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.boosting = false;
    });

    // Touch for steering
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (this.touchId === null && e.changedTouches.length > 0) {
        const touch = e.changedTouches[0];
        this.touchId = touch.identifier;
        this.touchX = touch.clientX;
        this.touchY = touch.clientY;
        this.updateAngleFromTouch(touch.clientX, touch.clientY);
      }
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.touchId) {
          this.touchX = touch.clientX;
          this.touchY = touch.clientY;
          this.updateAngleFromTouch(touch.clientX, touch.clientY);
        }
      }
    }, { passive: false });

    this.canvas.addEventListener('touchend', (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === this.touchId) {
          this.touchId = null;
        }
      }
    });

    // Mobile boost button
    this.mobileBoostBtn = document.getElementById('mobile-boost');
    if (this.mobileBoostBtn) {
      this.mobileBoostBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.boosting = true;
        this.mobileBoostBtn?.classList.add('active');
      });
      this.mobileBoostBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        this.boosting = false;
        this.mobileBoostBtn?.classList.remove('active');
      });
    }

    // Keyboard boost (space)
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        this.boosting = true;
      }
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space' || e.key === ' ') {
        this.boosting = false;
      }
    });

    // Resize
    window.addEventListener('resize', () => {
      this.updateCenter();
    });
  }

  private updateAngleFromTouch(x: number, y: number): void {
    this.updateCenter();
    const dx = x - this.centerX;
    const dy = y - this.centerY;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      this.targetAngle = Math.atan2(dy, dx);
    }
  }

  showMobileControls(show: boolean): void {
    if (this.mobileBoostBtn) {
      this.mobileBoostBtn.classList.toggle('hidden', !show || !this.isMobile);
    }
  }

  getIsMobile(): boolean {
    return this.isMobile;
  }
}
