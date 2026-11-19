import styles from "./Logo.module.css";

export function Logo() {
  return (
    <span className={styles.logo}>
      <svg className={styles.anillo} viewBox="0 0 36 36" aria-hidden="true" focusable="false">
        <path d="M18 3.5A14.5 14.5 0 1 1 3.5 18" fill="none" stroke="currentColor" strokeWidth={5} />
      </svg>
      <span className={styles.nombre}>Tiquetera Nube</span>
    </span>
  );
}
