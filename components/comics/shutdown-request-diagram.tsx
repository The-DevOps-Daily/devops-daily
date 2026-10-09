import styles from './comic-scene.module.css';

/** Node outlines and arrows are painted in the scene; only lettering is overlaid. */
export function ShutdownRequestDiagram() {
  const summary =
    'An earlier request reaches the old pod. Its app exits before replying, so the load balancer returns 502. Another, separate request succeeds through the healthy new pod. No request is transferred between pods.';
  return (
    <aside className={styles.diagram} aria-label="Request trace" data-comic-diagram>
      <div className={styles.diagramLabels} role="img" aria-label={summary}>
        <span className={styles.loadBalancer} aria-hidden="true">
          Load
          <br />
          balancer
        </span>
        <span className={styles.oldPod} aria-hidden="true">
          Old pod
          <br />
          App exits
        </span>
        <span className={styles.newPod} aria-hidden="true">
          New pod
          <br />
          Healthy
        </span>
        <span className={styles.interruptedReply} aria-hidden="true">
          Reply cut off: 502
        </span>
      </div>
      <ol className={styles.diagramText}>
        <li>
          <strong>The earlier request:</strong> load balancer → old pod (red box). The app exits
          before replying: 502.
        </li>
        <li>
          <strong>Another request:</strong> load balancer → new pod (green box). A separate request
          succeeds; the interrupted one is not transferred.
        </li>
      </ol>
    </aside>
  );
}
