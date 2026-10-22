const Svg = ({ children, size = 18 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

export const OpenIcon = () => (
  <Svg>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </Svg>
);
export const TextIcon = () => (
  <Svg>
    <path d="M5 6V5h14v1M12 5v14M9 19h6" />
  </Svg>
);
export const PenIcon = () => (
  <Svg>
    <path d="M4 20l4-1 11-11a2.1 2.1 0 0 0-3-3L5 16z" />
  </Svg>
);
export const UndoIcon = () => (
  <Svg>
    <path d="M9 14L4 9l5-5" />
    <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
  </Svg>
);
export const SaveIcon = () => (
  <Svg>
    <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
  </Svg>
);
export const RotateRightIcon = () => (
  <Svg size={16}>
    <path d="M20 4v5h-5" />
    <path d="M20 9a8 8 0 1 0 1 6" />
  </Svg>
);
export const RotateLeftIcon = () => (
  <Svg size={16}>
    <path d="M4 4v5h5" />
    <path d="M4 9a8 8 0 1 1-1 6" />
  </Svg>
);
export const MoveIcon = () => (
  <Svg size={14}>
    <path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3" />
  </Svg>
);
export const CloseIcon = () => (
  <Svg size={14}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);
export const ScanIcon = () => (
  <Svg size={14}>
    <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M8 10h8M8 14h5" />
  </Svg>
);
