import styles from './comic-scene.module.css';

export function ShutdownRequestDiagram({ id }: { id: string }) {
  const arrow = `${id}-arrow`;
  const failed = `${id}-failed-arrow`;
  const summary =
    'An earlier request reaches the old pod. Its app exits before replying, so the load balancer returns 502. Another, separate request succeeds through the healthy new pod. No request is transferred between pods.';

  return (
    <aside className={styles.diagram} aria-label="Request trace" data-comic-diagram>
      <svg className={styles.diagramSvg} viewBox="0 0 620 146" role="img" aria-label={summary}>
        <rect width="620" height="146" rx="6" fill="#fffdf5" />
        <defs>
          <marker
            id={arrow}
            markerWidth="7"
            markerHeight="7"
            refX="6"
            refY="3.5"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <path d="M 0 0 L 7 3.5 L 0 7 Z" fill="#273746" />
          </marker>
          <marker
            id={failed}
            markerWidth="7"
            markerHeight="7"
            refX="6"
            refY="3.5"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <path d="M 0 0 L 7 3.5 L 0 7 Z" fill="#9a4238" />
          </marker>
        </defs>
        <g fill="#fffdf5" stroke="#273746" strokeWidth="1.5">
          <rect x="4" y="54" width="140" height="46" rx="10" />
          <rect x="446" y="4" width="169" height="46" rx="10" />
          <rect x="446" y="92" width="169" height="46" rx="10" />
        </g>
        <g fill="none" strokeWidth="2">
          <path d="M 146 68 C 230 68 276 27 438 27" stroke="#273746" markerEnd={`url(#${arrow})`} />
          <path
            d="M 444 42 C 310 42 264 84 152 84"
            stroke="#9a4238"
            strokeDasharray="6 4"
            markerEnd={`url(#${failed})`}
          />
          <path
            d="M 146 94 C 278 94 320 114 438 114"
            stroke="#273746"
            markerEnd={`url(#${arrow})`}
          />
        </g>
        <g fill="#273746" fontSize="19" textAnchor="middle">
          <text x="74" y="73">
            Load
          </text>
          <text x="74" y="92">
            balancer
          </text>
          <text x="530" y="23">
            Old pod
          </text>
          <text x="530" y="43">
            App exits
          </text>
          <text x="530" y="111">
            New pod
          </text>
          <text x="530" y="132">
            Healthy
          </text>
          <text x="295" y="19">
            Already in flight
          </text>
          <text x="296" y="87" fill="#9a4238">
            Reply cut off: 502
          </text>
          <text x="294" y="137">
            Another request
          </text>
        </g>
      </svg>
      <ol className={styles.diagramText}>
        <li>
          <strong>The earlier request:</strong> load balancer → old pod. The app exits before
          replying: 502.
        </li>
        <li>
          <strong>Another request:</strong> load balancer → new pod. A separate request succeeds;
          the interrupted one is not transferred.
        </li>
      </ol>
    </aside>
  );
}
