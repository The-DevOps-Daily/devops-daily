/**
 * Crawlable explainer text for the simulator pages.
 *
 * The simulators are client apps, so a crawler sees little more than the
 * title and description. Each entry here is rendered as plain HTML under the
 * simulator (components/games/simulator-explainer.tsx), and its FAQ is
 * repeated word for word in FAQPage JSON-LD. Every "Try this" step must be
 * something the simulator really does: check the component before adding one.
 */

export interface SimulatorExplainerContent {
  /** 150-250 words: what the learner should understand afterwards. */
  summary: string;
  /** Short topic names for the LearningResource `teaches` field. */
  teaches: string[];
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  /** Three concrete things to do in this simulator. */
  tryThis: string[];
  faq: { question: string; answer: string }[];
}

const explainers: Record<string, SimulatorExplainerContent> = {
  'preview-environment-simulator': {
    summary:
      'A preview environment is a short-lived copy of your application that exists for one pull request. This simulator follows that copy through its whole life: a label on the pull request triggers a webhook, CI builds and pushes an image, an Argo CD ApplicationSet notices the labeled pull request and creates a namespace, and the environment gets data, DNS and TLS before reviewers see a private URL. When the pull request closes, the same flow runs in reverse and removes the review URL, the workloads, their dependencies and the namespace. With "Practice a failure" turned on, it injects a failure teams actually hit, one per pull request: a missing branch override, an unavailable preview secret, a deployed revision that drifted, a namespace quota that rejects the pods, a certificate stuck on the wrong DNS zone or a readiness gate failing on a migration, and asks you to pick a fix. Some of the offered fixes make the symptom disappear while creating a new risk, like copying a production secret or turning off a health gate. The point is to see why a preview environment is a GitOps workflow with guardrails, not just a deploy script with a random URL.',
    teaches: [
      'Preview environments per pull request',
      'GitOps with Argo CD ApplicationSets',
      'Ephemeral Kubernetes namespaces',
      'Safe test data for previews',
      'Environment teardown',
    ],
    level: 'Intermediate',
    tryThis: [
      'Add the preview label to the pull request and follow the event through the webhook, GitHub Actions and the Argo CD console until the preview URL appears.',
      'Turn on "Practice a failure", open the order status pull request and, when "Preview secret unavailable" appears, try the production-secret shortcut first to read why it is the wrong fix.',
      'Record a review decision, then click "Close PR & clean up" and watch the environment move to its removed state.',
    ],
    faq: [
      {
        question: 'What is a preview environment?',
        answer:
          'A temporary, isolated copy of an application created for a single pull request, with its own URL, so reviewers can test the change before it is merged. It is deleted when the pull request closes.',
      },
      {
        question: 'How does Argo CD create one environment per pull request?',
        answer:
          'An ApplicationSet with a pull request generator watches the repository, and for each matching open pull request (often filtered by a label) it renders an Argo CD Application, usually into its own namespace.',
      },
      {
        question: 'Should preview environments use production data?',
        answer:
          'No. Use synthetic data or a masked snapshot. Copying production data or production secrets into a short-lived environment widens the blast radius of a leak for little testing benefit.',
      },
    ],
  },

  'log-aggregation-pipeline-simulator': {
    summary:
      'A log pipeline moves events from the hosts that write them to a store where people can search them, and every hop has its own capacity. This simulator models that chain as six stages: apps and hosts, a Fluent Bit collector, a parse and filter step, a durable buffer, a search cluster and the explore view where you query logs. Each tick advances the pipeline by one stage, so you can see exactly where events pile up. Four scenarios cover the common ways pipelines break. A healthy flow drains normally. A traffic spike outruns the collector at the edge. A parser mismatch, caused by a deployment that changes the log format, makes structured parsing reject events. Slow indexing leaves the search cluster unable to keep up, so the buffer absorbs backpressure until it fills and starts dropping the oldest logs. The lesson is that a buffer turns a slow downstream into a queue instead of data loss, but only until it is full, which is why buffer depth is one of the first things to alert on.',
    teaches: [
      'Log collection with Fluent Bit',
      'Parsing and filtering logs',
      'Backpressure and durable buffers',
      'Log indexing capacity',
      'Alerting on log pipeline health',
    ],
    level: 'Intermediate',
    tryThis: [
      'Run the "Healthy flow" scenario, then switch to "Slow indexing" and watch the durable buffer grow until it reaches capacity and drops the oldest logs.',
      'Pick "Parser mismatch" and inspect the parse stage to see how many events structured parsing rejects after the log format changes.',
      'Step the pipeline one tick at a time and compare how a "Traffic spike" creates pressure at the collector instead of at the search cluster.',
    ],
    faq: [
      {
        question: 'What is backpressure in a log pipeline?',
        answer:
          'Backpressure is what happens when a downstream stage cannot accept data as fast as it arrives. Events queue up behind it, and without a buffer the upstream stage has to slow down or drop data.',
      },
      {
        question: 'Why put a buffer between the collector and the search cluster?',
        answer:
          'A durable buffer, such as Kafka or a disk-backed queue, absorbs bursts and slow indexing so logs wait instead of being lost. When it fills up, the pipeline has to pause upstream ingestion, reject new events or drop events, depending on its overflow policy.',
      },
      {
        question: 'Why do logs disappear after a deployment?',
        answer:
          'A common cause is a changed log format. If the parser expects the old structure, it rejects or misroutes the new events, so they never reach the index in a searchable form.',
      },
      {
        question: 'What should I alert on in a log pipeline?',
        answer:
          'Buffer depth and its growth rate, dropped or rejected events, parse failures, and the lag between when an event is written and when it becomes searchable.',
      },
    ],
  },

  'docker-under-the-hood-simulator': {
    summary:
      'Typing docker run feels like one action, but it is a hand-off between several programs. This simulator steps through what happens when you run docker run -p 8080:80 nginx, one layer at a time. The CLI sends the request to the Docker daemon, dockerd pulls the image by reading its manifest and downloading the layers, then hands the work to containerd. containerd assembles an OCI runtime bundle, with a config.json that describes the process, its namespaces and its limits, and runc uses that bundle to create the container. The last stages show the running nginx process and the fact that it runs on the host kernel, isolated by namespaces and limited by cgroups rather than by a separate operating system. Each stage also shows the real low-level command you can run on a Linux host to see that layer yourself. The goal is to replace the idea of a container as a small virtual machine with an accurate picture: a normal Linux process that the kernel isolates.',
    teaches: [
      'Docker daemon and containerd',
      'OCI images and runtime bundles',
      'runc and container creation',
      'Linux namespaces and cgroups',
      'Containers versus virtual machines',
    ],
    level: 'Intermediate',
    tryThis: [
      'Press play and let the walkthrough step from the docker run command down to the shared kernel, then step back with the previous button to any layer.',
      'Stop at the runtime bundle stage and read the config.json excerpt to see the process arguments and namespaces handed to runc.',
      'Copy the real command shown at a stage and run it on a Linux host to see the same layer on a live system.',
    ],
    faq: [
      {
        question: 'What is the difference between Docker, containerd and runc?',
        answer:
          'The Docker CLI talks to dockerd, which manages images, networks and volumes. dockerd delegates the container lifecycle to containerd, and containerd uses runc, a low-level OCI runtime, to actually create the isolated process.',
      },
      {
        question: 'Is a container a virtual machine?',
        answer:
          'No. A container is a regular process on the host that shares the host kernel. Namespaces limit what it can see and cgroups limit what it can use, while a virtual machine runs its own kernel on emulated hardware.',
      },
      {
        question: 'What is an OCI runtime bundle?',
        answer:
          'A directory with the container root filesystem and a config.json that describes the process to run, its environment, mounts, namespaces and resource limits. OCI runtimes such as runc read it to start the container.',
      },
    ],
  },

  'webhook-delivery-simulator': {
    summary:
      'A webhook is an HTTP request your system sends to someone else when an event happens, and delivering it reliably is harder than sending it once. This simulator models the delivery of sample events, such as invoice.paid or deployment.succeeded, to an endpoint whose behavior you choose: it can answer 200, fail intermittently, return a 500, time out, rate limit you with a 429 or reject the request with a 400. You can watch failed deliveries retry on a growing schedule until a 2xx response arrives or the attempts run out, the way Svix does it. The payloads are signed with real HMAC-SHA256, and you can tamper with a delivery by editing the body, using the wrong secret or replaying it later, then see verification catch each case. Together these show the three habits of a dependable webhook system: persist the event and retry with backoff, verify the signature over the raw bytes before parsing, and deduplicate on the receiving side because retries mean the same event can arrive more than once.',
    teaches: [
      'Webhook retries with exponential backoff',
      'HTTP status codes and retry decisions',
      'HMAC signature verification',
      'Replay protection',
      'Idempotent webhook handlers',
    ],
    level: 'Intermediate',
    tryThis: [
      'Compare "Intermittent", which succeeds after a couple of failures, with "500 error" and "400 bad request", which keep retrying until the attempts are exhausted.',
      'Switch the tampering option to "Edit body" or "Wrong secret" and watch signature verification reject the delivery.',
      'Try "Replay later" to see why a timestamp check matters even when the signature itself is valid.',
    ],
    faq: [
      {
        question: 'Which webhook responses should be retried?',
        answer:
          'Timeouts, connection errors, 5xx responses and 429 rate limits are usually temporary and always worth retrying with backoff. Senders differ on other 4xx codes: services such as Svix retry every non-2xx response until the attempts run out, while some treat a 400 as permanent.',
      },
      {
        question: 'How do webhook signatures work?',
        answer:
          'The sender computes an HMAC, commonly HMAC-SHA256, over the raw request body (often with a timestamp) using a shared secret, and sends it in a header. The receiver recomputes it over the exact bytes it received and compares the two.',
      },
      {
        question: 'Why must webhook handlers be idempotent?',
        answer:
          'Because retries mean the same event can be delivered more than once. Recording the event id and skipping ids you have already processed keeps a duplicate from charging, emailing or deploying twice.',
      },
    ],
  },

  'bounce-triage-simulator': {
    summary:
      'When an email cannot be delivered, the receiving server answers with an SMTP status code and a diagnostic message, and the sender has to decide what to do next. This simulator gives you real bounce messages, with codes and wording modeled on RFC 3463 enhanced status codes and on what major mailbox providers actually send, and asks you to triage each one. The possible actions are to suppress the address, retry later, fix the content, slow down, or stop and investigate. The central lesson is that the first digit of the code is a hint, not the answer. A 550 can mean the mailbox does not exist, which calls for suppression, but it can also mean your content was filtered or your domain failed DMARC authentication, where suppressing recipients only hides a problem on your side. A 4xx can mean greylisting, which a later retry fixes, or "too many messages", which means slow down. Reading the enhanced status code and the diagnostic text is what separates a correct decision from one that either damages your sender reputation by hammering a dead address or throws away a recipient who was only temporarily unavailable.',
    teaches: [
      'SMTP reply codes',
      'Enhanced status codes (RFC 3463)',
      'Hard versus soft bounces',
      'Suppression lists',
      'Sender reputation',
    ],
    level: 'Intermediate',
    tryThis: [
      'Read the first bounce, choose an action and press "Triage it" to see whether suppress, retry, fix content, slow down or investigate was right.',
      'Compare the 421 "Too many messages" bounce, which means slow down, with a 550 5.1.1 "User unknown" hard bounce and a 550 5.7.26 DMARC rejection that suppressing recipients would only hide.',
      'Work through every bounce with "Next bounce", then use "Start over" and try to get them all right on the second run.',
    ],
    faq: [
      {
        question: 'What is the difference between a hard bounce and a soft bounce?',
        answer:
          'A hard bounce is a permanent failure, such as a mailbox that does not exist, so the address should be suppressed. A soft bounce is temporary, such as a full mailbox or a busy server, so the message can be retried later.',
      },
      {
        question: 'Does every 5xx SMTP code mean the address is invalid?',
        answer:
          'No. Some providers return 5xx codes for policy blocks, rate limits or content filtering. The enhanced status code and the diagnostic text tell you whether the problem is the address, your content or your sending rate.',
      },
      {
        question: 'What is an enhanced status code?',
        answer:
          'A three-part code such as 5.1.1 defined in RFC 3463. The first part is the class (success, temporary or permanent), the second is the subject (address, mailbox, system, policy and so on) and the third gives the detail.',
      },
    ],
  },

  'binary-byte-simulator': {
    summary:
      'Binary shows up in day-to-day DevOps work in three places: the bytes behind every number, Unix file permissions and subnet masks. This simulator uses one set of flip tiles, modeled on the wooden binary demonstrators found in computing museums, for all three. In byte mode you flip eight tiles and watch the decimal value change, so you can see why each tile is worth double the one to its right. In permissions mode the same idea becomes nine tiles grouped as read, write and execute for the owner, the group and everyone else, which is exactly what chmod 644 or 755 encodes. In subnet mode you work with all 32 bits of an IPv4 mask and see why a valid mask is a single run of ones followed by zeros, with no gaps. Challenges ask you to build a target value, and a predict round hides the result so you have to work it out before checking. The aim is to make octal permissions and CIDR prefixes something you can reason about rather than look up.',
    teaches: [
      'Binary and decimal conversion',
      'Unix file permissions and chmod',
      'Octal notation',
      'Subnet masks and CIDR prefixes',
    ],
    level: 'Beginner',
    tryThis: [
      'In byte mode, start counting up from zero and watch how each tile doubles the value of the tile to its right.',
      'Switch to permissions mode and flip the tiles that turn 644 into 755, reading the owner, group and other groups as you go.',
      'Use subnet mode to build a /24 mask, then try to make a mask with a gap in the ones and see why it is not valid.',
    ],
    faq: [
      {
        question: 'What does chmod 755 mean?',
        answer:
          'Each digit is three bits for read (4), write (2) and execute (1). 7 is 4+2+1, so the owner can read, write and execute, while 5 is 4+1, so the group and others can read and execute but not write.',
      },
      {
        question: 'Why are Unix permissions written in octal?',
        answer:
          'Permissions come in groups of three bits, and one octal digit represents exactly three bits. That makes each digit map cleanly to one of owner, group and others.',
      },
      {
        question: 'Why can a subnet mask not have gaps?',
        answer:
          'A mask marks which leading bits of an address are the network part. It must be a continuous run of ones followed by zeros, which is why it can be written as a prefix length such as /24.',
      },
    ],
  },

  'agentic-loop-simulator': {
    summary:
      'Coding agents such as Claude Code do not write a change in one pass. They run a loop: plan the work, build it, judge the result, and go round again until a check says the task is done. This simulator plays one task through that loop slowly enough to follow. One phase lights up at a time, a decision gate shows whether the loop continues or stops, and a context window fills up as the attempts accumulate, which is why long loops eventually need summarizing or a fresh start. The most important control is a toggle that replaces the separate judge with the agent checking its own work. With an independent verifier, such as tests or a second reviewer, the loop catches the bug and ends with work that was actually verified. With a self-check, the same agent tends to approve what it just wrote, and the run can stop early or ship a confident bug. The takeaway is that the quality of an agentic workflow depends more on the verifier than on the builder.',
    teaches: [
      'Agentic loops: plan, build, judge',
      'Independent verification of AI-generated code',
      'Context window growth',
      'Stopping conditions for agents',
    ],
    level: 'Beginner',
    tryThis: [
      'Play the task through the loop and watch the decision gate choose to loop again or stop after each judge phase.',
      'Turn the separate judge into a self-check and replay the task to see how it ends with a confident bug instead of verified work.',
      'Use the previous and next buttons to step through a run and watch the context window grow with every attempt.',
    ],
    faq: [
      {
        question: 'What is an agentic loop?',
        answer:
          'A pattern where an AI agent repeatedly plans, acts and checks the result, feeding what it learned into the next attempt, until a stopping condition such as passing tests is met.',
      },
      {
        question: 'Why should a coding agent not grade its own work?',
        answer:
          'An agent that checks its own output shares the same blind spots that produced it, so it tends to approve its own mistakes. An independent verifier, such as tests, a linter or a separate reviewer, catches more real bugs.',
      },
      {
        question: 'Why does the context window matter in a long agent run?',
        answer:
          'Every step adds tokens. As the window fills, older details get less attention or must be summarized, so long loops benefit from clear checkpoints and fresh context.',
      },
    ],
  },

  'k8s-rbac-simulator': {
    summary:
      'Kubernetes RBAC answers one question: can this subject perform this verb on this resource in this namespace? kubectl auth can-i gives a yes or a no, but it does not tell you which binding granted the permission or why the binding you were sure about did not apply. This simulator answers the why. You pick a subject, a verb, a resource and a namespace, and it evaluates the Roles, ClusterRoles, RoleBindings and ClusterRoleBindings in the scenario and shows the rule that matched or the reason nothing did. The scenarios cover the behaviors that confuse people most. A ClusterRole bound with a RoleBinding only grants access inside that RoleBinding namespace. Nodes are not namespaced, so a RoleBinding can never grant them. A rule limited by resourceNames allows getting one secret but not listing them all. A roleRef that points to a role that does not exist grants nothing, and the simulator names the missing role. And there are no deny rules in RBAC: permissions only add up, so an unwanted permission is always explained by some rule that allows it.',
    teaches: [
      'Kubernetes RBAC',
      'Roles and ClusterRoles',
      'RoleBindings and ClusterRoleBindings',
      'Namespaced versus cluster-scoped resources',
      'Least-privilege access',
    ],
    level: 'Intermediate',
    tryThis: [
      'Open "The one that surprises everyone" and ask whether the CI service account can list pods in a namespace other than dev.',
      'Pick the "Nodes are not in a namespace" scenario and see why a RoleBinding cannot grant access to nodes.',
      'Try "One secret, not the list" and compare the answer for get on the named secret with list on all secrets.',
    ],
    faq: [
      {
        question: 'What is the difference between a Role and a ClusterRole?',
        answer:
          'A Role defines permissions inside one namespace. A ClusterRole defines permissions that can be used in any namespace, and it is the only way to describe access to cluster-scoped resources such as nodes.',
      },
      {
        question: 'What happens when you bind a ClusterRole with a RoleBinding?',
        answer:
          'The permissions apply only inside the namespace of the RoleBinding. This is a common way to reuse one ClusterRole definition across many namespaces without granting cluster-wide access.',
      },
      {
        question: 'Can you deny a permission in Kubernetes RBAC?',
        answer:
          'No. RBAC rules are purely additive. To remove access you have to remove or narrow the rule or binding that grants it.',
      },
      {
        question: 'How do I check what a service account can do?',
        answer:
          'Use kubectl auth can-i with --as, for example kubectl auth can-i list pods --as=system:serviceaccount:dev:ci -n dev. It answers yes or no, so you still need to read the bindings to find out why.',
      },
    ],
  },

  'cron-expression-simulator': {
    summary:
      'A cron expression is five fields: minute, hour, day of month, month and day of week. They look simple, and most cron bugs come from a few rules that are easy to forget. This simulator parses any expression you type and lists when it will actually fire next, in the timezone you choose, so arguments about a schedule can be settled by looking. Two grids show which minutes and hours are lit, which is how you see that */7 in the minute field fires at minutes 0, 7, 14 and so on up to 56, then again at 0, so the gap across the top of the hour is shorter than the rest. The examples cover the other traps. When both day of month and day of week are restricted, cron runs when either matches, not both. A job scheduled during a daylight saving change can be skipped or run twice. A date like 30 February never comes. And * * * * * runs 1,440 times a day, which is rarely what someone meant.',
    teaches: [
      'Cron expression syntax',
      'Step values and ranges',
      'Day-of-month and day-of-week rules',
      'Timezones and daylight saving time',
    ],
    level: 'Beginner',
    tryThis: [
      'Type */7 * * * * and look at the minute grid to see why the interval before the top of the hour is shorter than the others.',
      'Load "The OR trap" (0 9 1 * MON) and check the next runs to see it fire on the 1st and on every Monday.',
      'Load the job at 30 1 * * * in Europe/London and find the date when daylight saving makes it skip a run and the date when it runs twice.',
    ],
    faq: [
      {
        question: 'What does */5 mean in a cron expression?',
        answer:
          'It is a step: every 5th value of that field, starting from its first value. In the minute field, */5 means minutes 0, 5, 10 and so on up to 55.',
      },
      {
        question: 'Why does my cron job run on extra days?',
        answer:
          'If you restrict both day of month and day of week, classic cron runs the job when either one matches. 0 9 1 * MON runs at 09:00 on the 1st of every month and also on every Monday.',
      },
      {
        question: 'Which timezone does cron use?',
        answer:
          'Usually the timezone of the machine or scheduler running it, which is often UTC on servers and containers. Some schedulers, such as Kubernetes CronJobs, let you set a timezone per job.',
      },
    ],
  },

  'yaml-parsing-simulator': {
    summary:
      'YAML often decides your value is something other than what you typed. You type country: NO and get false, version: 1.10 and get 1.1, mode: 0755 and get a number, and a key on: push may come back as the boolean true. This simulator lets you edit YAML on one side and see what the parser resolved on the other, under both YAML 1.1 and YAML 1.2, because the two specifications disagree and that disagreement explains most YAML surprises. YAML 1.1 treats words like yes, no, on and off as booleans and reads numbers with leading zeros as octal, while YAML 1.2 is much stricter. The lessons cover the Norway problem, version numbers that are not strings, file modes, empty values that become null instead of an empty string, block scalars and their newlines, duplicate keys, anchors and merge keys, tabs used as indentation, and the missing space after a colon. The fix is usually the same: quote the value when it must stay a string.',
    teaches: [
      'YAML scalar types',
      'YAML 1.1 versus YAML 1.2',
      'The Norway problem',
      'Quoting in YAML',
      'Block scalars, anchors and merge keys',
    ],
    level: 'Beginner',
    tryThis: [
      'Open "The Norway problem" and compare how country: NO resolves under YAML 1.1 and YAML 1.2.',
      'Type version: 1.10 and then version: "1.10" to see why version numbers need quotes.',
      'Open "Block scalars keep your newlines" and compare the pipe and the angle bracket on a multi-line script.',
    ],
    faq: [
      {
        question: 'What is the Norway problem in YAML?',
        answer:
          'Under YAML 1.1, unquoted words such as NO, yes, on and off are read as booleans, so the country code NO for Norway becomes false. Quoting it as "NO" keeps it a string.',
      },
      {
        question: 'What is the difference between YAML 1.1 and YAML 1.2?',
        answer:
          'YAML 1.2 narrowed the implicit types: only true and false are booleans, and a leading zero no longer means octal. Many tools still use YAML 1.1 rules, which is why the same file can parse differently.',
      },
      {
        question: 'When should I quote values in YAML?',
        answer:
          'Quote anything that must stay a string but looks like another type: country codes, version numbers, values with leading zeros, yes and no, and strings that start with special characters.',
      },
    ],
  },

  'sql-terminal-simulator': {
    summary:
      'This SQL simulator is a guided playground for learning queries on a small e-commerce schema with customers, products, orders and order items. The lessons build up in the order most people need them: SELECT basics, filtering with WHERE, sorting and limiting, DISTINCT, counting rows, GROUP BY, HAVING with averages, joining tables, revenue across joins, subqueries and window functions, LEFT JOIN, INSERT, UPDATE and DELETE, and common table expressions. Single-table SELECT queries run live in your browser against the sample data, so you can change a filter or a sort order and see the result immediately. The guided join, subquery and window function lessons return output captured from a real PostgreSQL instance, so their results match what Postgres actually returns. Nothing is sent to a server, so a typo or an unexpected result costs nothing, and a separate challenges mode has eight exercises where you write the queries yourself. The same data also appears as documents in the MongoDB simulator, which makes it easy to compare the two models.',
    teaches: [
      'SQL SELECT queries',
      'Filtering, sorting and aggregation',
      'Joins and LEFT JOIN',
      'Subqueries, window functions and CTEs',
      'INSERT, UPDATE and DELETE',
    ],
    level: 'Beginner',
    tryThis: [
      'Start with "SELECT basics" and change the WHERE clause on the customers table to see the result update in the browser.',
      'Work through "GROUP BY" and "HAVING and averages" to see the difference between filtering rows and filtering groups.',
      'Open "LEFT JOIN" and see how customers without pending orders stay in the result with NULL order fields.',
    ],
    faq: [
      {
        question: 'What is the difference between WHERE and HAVING?',
        answer:
          'WHERE filters rows before they are grouped, while HAVING filters groups after GROUP BY and can use aggregates such as COUNT or AVG.',
      },
      {
        question: 'What is the difference between an INNER JOIN and a LEFT JOIN?',
        answer:
          'An INNER JOIN returns only rows with a match in both tables. A LEFT JOIN returns every row from the left table and fills the right side with NULL where there is no match.',
      },
      {
        question: 'What is a common table expression?',
        answer:
          'A named subquery defined with WITH at the start of a query. It makes long queries easier to read and lets you refer to the same intermediate result more than once.',
      },
    ],
  },

  'postgres-terminal-simulator': {
    summary:
      'PostgreSQL has its own command-line client, psql, with meta-commands such as \\dt and \\l that are not SQL at all, and its own query planner that decides how each query runs. This simulator lets you practice both in a psql-style terminal. The database models a small e-commerce schema plus a 200,000-row big_events table, and every listing, query result and EXPLAIN plan is reproduced from real PostgreSQL output. The guided steps walk you from exploring the database and running a query to listing indexes, reading the EXPLAIN plan for a filter on the big table, creating an index and running EXPLAIN again. The estimated cost drops from 3971 to 145 once the index exists, which is exactly what Postgres reports. EXPLAIN ANALYZE then shows the actual rows and scan work next to the estimates, and a transactions step shows how BEGIN and ROLLBACK undo a DELETE. Nothing connects to a server, so it is safe to experiment, and the intuition you build carries straight over to a real database.',
    teaches: [
      'psql meta-commands',
      'PostgreSQL indexes',
      'EXPLAIN and EXPLAIN ANALYZE',
      'Sequential scans versus index scans',
      'Transactions',
    ],
    level: 'Intermediate',
    tryThis: [
      'Run \\dt to list the tables, then \\d customers to see its columns and the primary key index Postgres created for it.',
      'Follow "EXPLAIN a filter", "Create an index" and "EXPLAIN again" to watch the plan switch from a sequential scan and the cost drop.',
      'Run the "EXPLAIN ANALYZE" step and compare the actual row counts with the estimated rows and costs from plain EXPLAIN.',
    ],
    faq: [
      {
        question: 'What is the difference between EXPLAIN and EXPLAIN ANALYZE?',
        answer:
          'EXPLAIN shows the plan Postgres would use with estimated costs and row counts. EXPLAIN ANALYZE actually runs the query and adds real timings and row counts, so be careful with it on statements that change data.',
      },
      {
        question: 'Why does Postgres not use my index?',
        answer:
          'The planner picks the cheapest plan it can estimate. On small tables, or when a filter matches a large share of rows, a sequential scan is often cheaper than an index scan. Outdated statistics can also mislead it, which ANALYZE fixes.',
      },
      {
        question: 'How do I list tables in psql?',
        answer:
          'Use \\dt for tables visible through the current search path, \\d table_name to describe one table, and \\l to list databases. These are psql meta-commands, so they end without a semicolon.',
      },
    ],
  },

  'mongodb-terminal-simulator': {
    summary:
      'MongoDB stores documents instead of rows, and you query it with JavaScript-style calls in the mongo shell rather than with SQL. This simulator runs a subset of that shell in your browser against three small collections, customers, products and orders, which hold the same e-commerce data as the SQL simulator so you can compare the two models directly. The lessons cover find() basics, projections that choose which fields come back, query operators such as $gt and $in, sorting and limiting, paging with skip, counting documents, inserting, updating and deleting documents, and the aggregation pipeline with $match and $group. Every command is evaluated live by a small query and aggregation engine, so a filter you invent behaves like the examples. Orders hold their line items inside the document, which shows the main design difference from a relational schema: data that is read together is often stored together. A separate challenges mode adds query exercises, and nothing is sent to a server, so you can experiment freely.',
    teaches: [
      'MongoDB find queries',
      'Projections and query operators',
      'Sorting, limiting and paging',
      'Insert, update and delete',
      'The aggregation pipeline',
    ],
    level: 'Beginner',
    tryThis: [
      'Run db.customers.find() and then add a projection so only the name and country fields come back.',
      'Open "Matching a set with $in" and filter products by several categories at once.',
      'Work through "Aggregation: $match + $group" to filter products by price and count them per category with an average price, then compare it with GROUP BY in the SQL simulator.',
    ],
    faq: [
      {
        question: 'What is a projection in MongoDB?',
        answer:
          'The second argument to find(), which chooses the fields to return. For example, find({}, { name: 1, _id: 0 }) returns only the name field.',
      },
      {
        question: 'What is the MongoDB aggregation pipeline?',
        answer:
          'A sequence of stages, such as $match, $group, $sort and $project, that each transform the documents passed to them. It does the job that WHERE, GROUP BY and ORDER BY do in SQL.',
      },
      {
        question: 'When should I use MongoDB instead of a relational database?',
        answer:
          'When your data is naturally document shaped and read together, and the schema changes often. If you need many-to-many joins or strict multi-row transactions across tables, a relational database is usually simpler.',
      },
    ],
  },

  'fork-bomb-simulator': {
    summary:
      'The Bash fork bomb :(){ :|:& };: fits in thirteen characters and can freeze a Linux machine that has no process limits. This simulator takes it apart symbol by symbol: the colon is the function name, the body calls the function twice through a pipe, the ampersand sends the copies to the background, and the final colon starts it. Then it runs a safe visual version, so you can watch the process count grow exponentially until it hits the PID limit and the system runs out of room to start anything new, including the shell you would use to stop it. The second half is about defense. Three protections each cap a user at 100 processes: ulimit -u in the shell, pids.max in a cgroup, and TasksMax in a systemd unit. You can change the system PID limit and see that a protection only helps when its cap is lower than the system-wide limit. The lesson applies well beyond fork bombs: any runaway process tree, from a buggy script to a broken container, is contained the same way.',
    teaches: [
      'Fork bombs and process growth',
      'Resource exhaustion on Linux',
      'ulimit -u',
      'cgroup pids.max',
      'systemd TasksMax',
    ],
    level: 'Beginner',
    tryThis: [
      'Read the breakdown of :(){ :|:& };: one symbol at a time before you start the simulation.',
      'Press Start with no protection and watch the process count climb until it reaches the PID limit.',
      'Turn on the ulimit -u, cgroups or systemd protection, start again and see the process tree stop at 100.',
    ],
    faq: [
      {
        question: 'What does :(){ :|:& };: do?',
        answer:
          'It defines a function named : that calls itself twice, piping one copy into the other and running them in the background, then calls it. The number of processes doubles each round until the system cannot create more.',
      },
      {
        question: 'How do I protect a Linux system from a fork bomb?',
        answer:
          'Limit how many processes a user or service can create: ulimit -u or /etc/security/limits.conf for login users, pids.max in a cgroup, or TasksMax in a systemd unit. Containers can be limited with the pids limit of the runtime.',
      },
      {
        question: 'How do you stop a running fork bomb?',
        answer:
          'It is hard once the process table is full, because you may not be able to start kill or a new shell. If you still have a shell, killall with the process name or sending SIGSTOP and then SIGKILL to the user processes can work; often a reboot is the only option.',
      },
    ],
  },

  'aws-vpc-simulator': {
    summary:
      'An AWS VPC is a private network you assemble from parts, and traffic only flows when each part is in place and the route tables point the right way. In this simulator you build that network yourself: add public and private subnets, an internet gateway, a NAT gateway, route tables and EC2 instances, and a validator tells you when a piece is missing, for example an internet gateway without a public subnet or a NAT gateway without a private subnet to serve. Then you test three traffic flows step by step. A request from the internet reaches a public instance through the internet gateway and the public route table. A private instance reaches the internet through the NAT gateway, which translates its address, while nothing on the internet can start a connection to it. And a public web server talks to a private instance through the local route inside the VPC. Seeing each hop makes the public versus private subnet distinction concrete: a subnet is public only because its route table sends 0.0.0.0/0 to an internet gateway.',
    teaches: [
      'AWS VPC design',
      'Public and private subnets',
      'Internet gateways and NAT gateways',
      'Route tables',
    ],
    level: 'Beginner',
    tryThis: [
      'Add an internet gateway before a public subnet and read the validation message that explains what is missing.',
      'Build the full network and test traffic from the private instance to the internet to watch the NAT gateway translate the address on the way out.',
      'Test traffic from the public instance to the private one and follow the request through the internal VPC routing.',
    ],
    faq: [
      {
        question: 'What makes a subnet public in AWS?',
        answer:
          'Its route table has a route for 0.0.0.0/0 (and ::/0 for IPv6) to an internet gateway. Instances in it also need a public IP address to be reachable from the internet.',
      },
      {
        question: 'What is the difference between an internet gateway and a NAT gateway?',
        answer:
          'An internet gateway allows two-way traffic between the internet and resources with public IPs. A NAT gateway, placed in a public subnet, lets instances in private subnets start outbound connections without accepting inbound ones.',
      },
      {
        question: 'Can instances in a private subnet reach the internet?',
        answer:
          'Only outbound: through a NAT gateway or NAT instance for IPv4, or an egress-only internet gateway for IPv6. Inbound connections from the internet cannot reach them directly. VPC endpoints are separate and give private access to supported AWS services.',
      },
    ],
  },

  'dns-simulator': {
    summary:
      'Every time you open a website, a DNS lookup turns its name into an address, and most lookups never reach the authoritative server at all. This simulator walks a query through each layer. It checks the browser cache, then the operating system cache, then asks a recursive resolver. On a cache miss the resolver asks a root server, which refers it to the server for the top-level domain, which refers it to the authoritative server that holds the actual record. The answer travels back and is cached at each layer for as long as its TTL allows. You can type a domain and choose the record type, such as A for an IPv4 address, AAAA for IPv6, CNAME for an alias or TXT for text records, then run the lookup step by step. Run it a second time and the caches answer immediately, which is why changing a DNS record does not take effect everywhere at once and why a low TTL before a migration matters.',
    teaches: [
      'DNS resolution',
      'Recursive resolvers',
      'Root, TLD and authoritative servers',
      'DNS caching and TTL',
      'DNS record types',
    ],
    level: 'Beginner',
    tryThis: [
      'Look up example.com as an A record and step through the root, TLD and authoritative servers.',
      'Run the same lookup again and see the browser or OS cache answer without leaving your machine.',
      'Switch the record type to CNAME or TXT and compare the answer with the A record.',
    ],
    faq: [
      {
        question: 'What happens when I type a domain name into my browser?',
        answer:
          'The browser and operating system check their caches. If the answer is not cached, a recursive resolver looks it up by asking a root server, then the TLD server, then the domain authoritative server, and returns the address.',
      },
      {
        question: 'What is a DNS TTL?',
        answer:
          'Time to live: the number of seconds a resolver may cache a record before asking again. Lowering it before a change lets the new value spread faster.',
      },
      {
        question: 'What is the difference between an A record and a CNAME record?',
        answer:
          'An A record maps a name to an IPv4 address. A CNAME makes a name an alias for another name, and the resolver then looks up the target. A CNAME cannot sit at the zone apex alongside other records.',
      },
    ],
  },

  'db-indexing-simulator': {
    summary:
      'An index lets a database find rows without reading the whole table, but only when the query matches the way the index is ordered. This simulator runs queries against a small users table and shows how many rows each one has to examine. Without an index, every query is a full table scan. You can add a B-tree index on a single column or a composite index on two columns, then run queries such as find by email, find by age, an age range, and filters on age and city together. The interesting part is the leftmost prefix rule. A composite index on age and city helps a query that filters on age, and helps more when it filters on both, but it cannot help a query that filters only on city, because city is not the first column. The simulator still lists such an index as present but unusable for seeking. Seeing the scanned row counts change makes it clear why column order matters, and why adding an index for every column is not the answer: each one costs storage and slows down writes.',
    teaches: [
      'Database indexes',
      'B-tree indexes',
      'Composite indexes and the leftmost prefix rule',
      'Full table scans versus index lookups',
      'Index trade-offs',
    ],
    level: 'Beginner',
    tryThis: [
      'Run "Find by Email" with no index, then add an index on email and run it again to compare the rows examined.',
      'Create a composite index on age and city and run "Age + City", then run "Find by City" alone and see why it cannot use that index.',
      'Run "Age Range" with and without an age index to see how a B-tree handles a range.',
    ],
    faq: [
      {
        question: 'What is a database index?',
        answer:
          'A separate data structure, usually a B-tree, that keeps the values of one or more columns sorted with pointers to the rows. It lets the database find matching rows without scanning the whole table.',
      },
      {
        question: 'What is the leftmost prefix rule?',
        answer:
          'A composite index on (a, b) is sorted by a first, so it can seek directly for filters on a, or on a and b. A filter on b alone cannot seek into it; the database may still read the whole index or, in some engines, use a skip scan, but usually far less efficiently.',
      },
      {
        question: 'Why not index every column?',
        answer:
          'Every index takes storage and must be updated on each insert, update and delete, so writes get slower. Index the columns your frequent queries filter, join or sort on.',
      },
    ],
  },

  'database-replication-sharding-scaling': {
    summary:
      'When one database server is no longer enough, there are three directions to grow: copy the data to more servers, split it across servers, or make the one server bigger. This simulator has a tab for each. In the replication tab you choose a single-leader, multi-leader or leaderless topology, switch between synchronous and asynchronous replication, add replicas, change the load and the share of writes, and watch replication lag, latency, stale-read risk and availability respond. You can also take the primary down and see how each topology copes. In the sharding tab you choose hash or range partitioning and a shard key such as user_id, region, created_at or tenant_id, then watch how rows spread and whether a sample query reaches one shard or all of them. Range partitioning on a timestamp, for example, sends all new writes to the same shard. In the scaling tab you combine a bigger server, replicas, shards and connection pooling against a given load. The point is that replicas scale reads and availability, while write capacity grows only with a bigger primary or with more shards, and sharding adds the most complexity.',
    teaches: [
      'Database replication',
      'Synchronous versus asynchronous replication',
      'Sharding and shard keys',
      'Hash versus range partitioning',
      'Vertical and horizontal database scaling',
    ],
    level: 'Intermediate',
    tryThis: [
      'In the replication tab, switch from async to sync replication and compare replication lag, latency and stale-read risk, then take the primary down in a single-leader setup.',
      'In the sharding tab, choose range partitioning on created_at and watch new writes pile onto one shard, then switch to hash on user_id.',
      'In the scaling tab, raise the write share of the load and see that adding replicas stops helping while adding shards still does.',
    ],
    faq: [
      {
        question: 'What is the difference between replication and sharding?',
        answer:
          'Replication keeps full copies of the same data on several servers, which helps reads and availability. Sharding splits the data so each server holds only part of it, which is what lets writes scale.',
      },
      {
        question: 'Synchronous or asynchronous replication: which should I use?',
        answer:
          'Synchronous replication waits for a replica to confirm each write, so a failover loses nothing but every write is slower. Asynchronous replication is faster but can lose the most recent writes if the primary fails.',
      },
      {
        question: 'How do I choose a shard key?',
        answer:
          'Pick a key that spreads writes evenly and that most queries include, so they hit one shard. Keys that grow over time, such as a timestamp with range partitioning, create a hot shard.',
      },
    ],
  },

  'postgres-wire-protocol': {
    summary:
      'Every PostgreSQL client, from psql to an ORM, talks to the server with the same message-based wire protocol, and knowing its shape explains a lot of connection and performance behavior. This simulator animates those messages one at a time. The startup scenario shows the optional TLS request, the startup parameters, a SASL authentication exchange that ends in AuthenticationOk, the ParameterStatus messages and finally ReadyForQuery. The simple query scenario sends one Query message and gets back a RowDescription, a stream of DataRow messages and CommandComplete. The extended query scenario splits the work into Parse, Bind, Describe, Execute and Sync, which is how prepared statements and parameter binding work and why pipelining several of them saves round trips. The COPY scenario shows bulk data streamed as CopyData chunks. You can turn TLS and pipelining on and off, change the number of rows and inject an error to see an ErrorResponse arrive, so the flow stops being a black box when you debug a driver, a pooler or a slow query.',
    teaches: [
      'PostgreSQL wire protocol',
      'Startup and SASL authentication',
      'Simple versus extended query protocol',
      'Prepared statements and pipelining',
      'COPY streaming',
    ],
    level: 'Advanced',
    tryThis: [
      'Play the startup scenario and follow the messages from the TLS request to ReadyForQuery.',
      'Compare the simple query and extended query scenarios, then turn pipelining off and see the extra round trips.',
      'Turn on error injection and watch where the ErrorResponse appears in the flow.',
    ],
    faq: [
      {
        question:
          'What is the difference between the simple and extended query protocol in PostgreSQL?',
        answer:
          'The simple protocol sends the whole SQL string in one Query message. The extended protocol splits it into Parse, Bind and Execute, which allows prepared statements, separate parameters and pipelining.',
      },
      {
        question: 'How does PostgreSQL authenticate a client?',
        answer:
          'After the startup message the server asks for credentials. Modern servers use SASL with SCRAM-SHA-256, a challenge and response exchange that proves the client knows the password without sending it.',
      },
      {
        question: 'Why is COPY faster than many INSERT statements?',
        answer:
          'COPY streams rows as raw data chunks in a single command, avoiding a round trip and a parse step per row, so bulk loads are much faster.',
      },
    ],
  },

  'docker-terminal-simulator': {
    summary:
      'This Docker simulator is a browser terminal where you practice the commands you use every day without installing Docker or risking a real host. Six lessons take you from the basics to a small application. Docker daemon basics covers docker version and docker info, pulling an image and listing what is stored locally. Container lifecycle covers running a container in the background, listing it, reading its logs, stopping it and starting it again. Debugging containers covers exec and inspect. Build images covers reading a Dockerfile, building and tagging an image and checking its layer history. Data and networking covers named volumes such as pgdata and user-defined bridge networks such as appnet, and why containers on the same network can reach each other by name. Compose workflow brings it together with docker compose up -d, ps and down for a two-service app. Each command is checked as you type it, the output looks like what Docker prints, and your progress is tracked per lesson, so you build muscle memory for the flags that matter, like -d, -p, -v, --name and --network.',
    teaches: [
      'Docker CLI commands',
      'Container lifecycle',
      'Debugging containers',
      'Docker volumes and networks',
      'Docker Compose',
    ],
    level: 'Beginner',
    tryThis: [
      'Work through "Container lifecycle" to run nginx in the background on port 8080, read its logs, stop it and start it again.',
      'Open "Data & Networking" to create the appnet network and pgdata volume and run a database container that uses both.',
      'Finish with "Compose workflow" and bring the two-service app up and down with docker compose.',
    ],
    faq: [
      {
        question: 'What is the difference between docker run and docker start?',
        answer:
          'docker run creates a new container from an image and starts it. docker start starts an existing container that was stopped, keeping its configuration and writable layer.',
      },
      {
        question: 'How do containers talk to each other in Docker?',
        answer:
          'Put them on the same user-defined network. Docker provides DNS on that network, so a container can reach another one by its name, for example db:5432.',
      },
      {
        question: 'What is a Docker volume?',
        answer:
          'Storage managed by Docker that lives outside the container writable layer, so data such as a database survives when the container is removed and recreated.',
      },
    ],
  },

  'kubernetes-terminal-simulator': {
    summary:
      'This Kubernetes simulator is a browser terminal for practicing kubectl against a small three-node cluster, without a real cluster or a cloud account. Six lessons follow the order in which you meet things on the job. Cluster basics checks the client version, the current context, the cluster endpoints and the nodes. Pods and deployments reads a deployment manifest and lists the deployment and the pods it created. Services and networking reads a service manifest, lists services and describes one to see how it selects pods. Scaling and rollouts checks a rollout status, changes the image with kubectl set image and reads the rollout history. Debugging workloads covers logs, describe, exec and cluster events, which is where most real troubleshooting happens. Config and cleanup lists ConfigMaps and deletes the service and the deployment. Every command is checked as you type it, and the output follows what kubectl prints, so the habits you build carry straight over to a real cluster.',
    teaches: [
      'kubectl basics',
      'Pods and Deployments',
      'Kubernetes Services',
      'Rollouts and rollout history',
      'Debugging Kubernetes workloads',
    ],
    level: 'Beginner',
    tryThis: [
      'Start with "Cluster Basics" and run kubectl config current-context and kubectl get nodes.',
      'In "Scaling & Rollouts", change the image with kubectl set image and then read kubectl rollout history.',
      'Use "Debugging Workloads" to read logs, describe a pod and list events, the usual order when a pod misbehaves.',
    ],
    faq: [
      {
        question: 'What is the difference between a Pod and a Deployment?',
        answer:
          'A Pod is one or more containers scheduled together. A Deployment manages a set of identical Pods through a ReplicaSet, keeping the desired number running and handling rolling updates and rollbacks.',
      },
      {
        question: 'How do I debug a Kubernetes pod that keeps restarting?',
        answer:
          'Start with kubectl describe pod for events and the last state, then kubectl logs, adding --previous to see the logs of the crashed container, and kubectl get events for cluster-level causes such as scheduling or image pull errors.',
      },
      {
        question: 'How do I roll back a Kubernetes deployment?',
        answer:
          'Run kubectl rollout undo deployment/NAME to return to the previous revision, or add --to-revision with a number from kubectl rollout history.',
      },
    ],
  },

  'terraform-terminal-simulator': {
    summary:
      'Terraform describes infrastructure in HCL files and keeps a state file that records what it created, so the core skill is reading what a change will do before you apply it. This simulator walks through the whole workflow in a browser terminal, with no cloud account and nothing created for real. You initialize the working directory, validate the configuration, run a plan and read it, then apply it. Next you make a change to the configuration and plan again, which is where Terraform shows its real value: the plan compares your files with the existing state and marks each resource with + for create, ~ for change in place or - for destroy. After applying, you list what is in the state, read the outputs, and finally destroy everything, the habit that keeps throwaway environments from running up a bill. Along the way the lab explains the building blocks you see in the files: providers, resources, variables, outputs and state.',
    teaches: [
      'Infrastructure as code with Terraform',
      'terraform init, plan and apply',
      'Reading a Terraform plan',
      'Terraform state',
      'terraform destroy',
    ],
    level: 'Beginner',
    tryThis: [
      'Run terraform init, terraform validate and terraform plan, and read what the plan says it will create.',
      'After the first apply, make the change the lab suggests and run terraform plan again to see a ~ change in place.',
      'List the resources with terraform state list, read terraform output, then tear everything down with terraform destroy.',
    ],
    faq: [
      {
        question: 'What does terraform plan do?',
        answer:
          'It compares your configuration with the state and with the real infrastructure, and shows what Terraform would create (+), change in place (~) or destroy (-) without changing anything.',
      },
      {
        question: 'What is the Terraform state file?',
        answer:
          'A record of the resources Terraform manages and their current attributes. Terraform uses it to work out what a change will do, so teams store it in a shared, locked remote backend.',
      },
      {
        question: 'What is the difference between terraform plan and terraform apply?',
        answer:
          'plan only shows the proposed changes. apply makes them, after showing the same plan and asking for confirmation unless you pass -auto-approve.',
      },
    ],
  },

  'latency-percentiles-simulator': {
    summary:
      'Latency percentiles answer a question averages cannot: how slow are the slowest requests? P90, P95 and P99 are cutoffs in a sorted list of request times. P99 is the time that 99 percent of requests are faster than, so one request in a hundred is slower. This simulator plots a latency distribution with P90, P95 and P99 markers and shows the average and P50 in separate metric cards, so you can see how a long tail moves the high percentiles while the average and median barely change. Five scenarios show common shapes: a healthy API where the percentiles sit close together, cache churn where misses add a visible upper band, a noisy neighbor whose CPU and disk contention stretch the tail, cold starts where a few very slow requests dominate P99, and a rolling deploy where warmup, image pulls and connection churn create a fat tail. The takeaway is practical: an average can look fine while one user in a hundred waits seconds, so SLOs and alerts should be written against high percentiles, and the metric has to match the experience you are promising.',
    teaches: [
      'Latency percentiles: P50, P90, P95, P99',
      'Average versus median versus percentile',
      'Long-tail latency',
      'Latency-based SLOs',
    ],
    level: 'Beginner',
    tryThis: [
      'Start with "Healthy API" and compare the average, P50 and P99 values in the metric cards.',
      'Switch to "Cold Starts" and watch P99 jump while the median hardly moves.',
      'Compare "Cache Churn" and "Noisy Neighbor" to see two different reasons a tail can grow.',
    ],
    faq: [
      {
        question: 'What does P99 latency mean?',
        answer:
          '99 percent of requests completed faster than the P99 value, so 1 percent were slower. It describes the experience of the slowest requests, which averages hide.',
      },
      {
        question: 'Why is average latency misleading?',
        answer:
          'A few very slow requests barely move the average when most are fast, yet those are the requests users notice. Percentiles show the tail directly.',
      },
      {
        question: 'Can you average percentiles across servers?',
        answer:
          'No. The average of each server P99 is not the P99 of all requests. You need the combined distribution, for example from histogram buckets, to compute a correct overall percentile.',
      },
    ],
  },

  'kubernetes-networking-cni-simulator': {
    summary:
      'Kubernetes networking has two layers that are easy to mix up: the CNI plugin that gives every pod an IP address and moves packets between pods, and Services that give a stable virtual address in front of a changing set of pods. This simulator animates packet paths through both. You can follow a pod talking to another pod on the same node, a pod reaching a pod on another node, a request to a ClusterIP Service that gets translated to one backend endpoint, a headless Service that returns pod addresses through DNS from the EndpointSlice, traffic entering through an Ingress, and traffic arriving through a cloud LoadBalancer or a NodePort. You can switch between an overlay CNI, a routed CNI and an eBPF CNI to see how the same packet crosses nodes in each: wrapped in an encapsulation header, routed natively by the network, or handled by eBPF programs in the kernel. The goal is to know which layer to suspect when a connection fails: pod-to-pod problems point to the CNI, while a working pod IP behind a failing Service points to selectors, endpoints or kube-proxy.',
    teaches: [
      'Kubernetes CNI plugins',
      'Pod-to-pod networking',
      'ClusterIP, NodePort and LoadBalancer Services',
      'EndpointSlices and headless Services',
      'Ingress routing',
    ],
    level: 'Advanced',
    tryThis: [
      'Play "Pod to Pod, Cross Node" with the overlay CNI, then switch to the routed and eBPF CNIs and compare how the packet crosses nodes.',
      'Follow the "ClusterIP Service" path and watch where the Service virtual IP is translated to a real endpoint.',
      'Open "EndpointSlice & Headless DNS" to see how a headless Service skips the virtual IP entirely.',
    ],
    faq: [
      {
        question: 'What does a CNI plugin do in Kubernetes?',
        answer:
          'It sets up networking for each pod: creates its network interface, assigns an IP address from the node pod range and makes sure pods can reach each other across nodes, using overlays, native routing or eBPF.',
      },
      {
        question: 'What is the difference between ClusterIP, NodePort and LoadBalancer?',
        answer:
          'ClusterIP gives a virtual IP reachable inside the cluster. NodePort also opens the same port on every node. LoadBalancer builds on that and asks the cloud provider for an external load balancer in front of the nodes.',
      },
      {
        question: 'What is a headless Service?',
        answer:
          'A Service with clusterIP set to None. DNS returns the IPs of the ready pods directly instead of a single virtual IP, which stateful workloads use to address individual pods.',
      },
    ],
  },

  'git-merge-conflict-simulator': {
    summary:
      'A merge conflict is Git telling you that two branches changed the same lines and it will not guess which version to keep. This simulator puts you inside small repositories frozen at that moment and lets you resolve them with real commands. The engine keeps HEAD, the index and the working tree separately the way Git does, and its output follows what recent Git versions print. The lessons start with reading the conflict markers and the base version, then resolving by editing the file, then taking a whole side with git checkout --ours or --theirs. One lesson shows that during a rebase ours and theirs are swapped, because the branch you are rebasing onto becomes ours. Another shows the escape hatch, git merge --abort, which puts everything back as it was. The last lesson is the one Git cannot see: two branches that merge cleanly but break the code together, which is why a clean merge still needs tests. You leave knowing how to read git status during a conflict instead of panicking at it.',
    teaches: [
      'Git merge conflicts',
      'Conflict markers and the merge base',
      'git checkout --ours and --theirs',
      'Conflicts during a rebase',
      'Aborting a merge',
    ],
    level: 'Beginner',
    tryThis: [
      'Open "Read the conflict" and run git status to see which files are both modified.',
      'In "Resolve by editing", fix the file, then git add it and commit to finish the merge.',
      'Try "Rebase flips ours and theirs" and check which version git checkout --ours keeps during a rebase.',
    ],
    faq: [
      {
        question: 'What do the conflict markers mean?',
        answer:
          'The lines between <<<<<<< and ======= are your side (HEAD), the lines between ======= and >>>>>>> are the incoming side, and with diff3 style a ||||||| section shows the common ancestor.',
      },
      {
        question: 'Why are ours and theirs reversed during a rebase?',
        answer:
          'A rebase replays your commits on top of the other branch, so HEAD is the branch you are rebasing onto. That makes it ours, and your own commit becomes theirs.',
      },
      {
        question: 'How do I cancel a merge with conflicts?',
        answer:
          'Run git merge --abort, or git rebase --abort during a rebase. Git returns the branch to where it was before the operation; if you had uncommitted changes when the merge started, merge --abort may not be able to restore them, so commit or stash first.',
      },
    ],
  },

  'git-concepts-simulator': {
    summary:
      'Most Git confusion comes from not having a clear picture of where your changes are: in the working directory, in the staging area, in a local commit or on the remote. This simulator teaches that model first and the commands second. You start by looking around a small repository with git status and git log, then create a file, stage it, check the staged diff and commit it, and push it to the remote. Next you create a branch, commit on it and merge it back into main, watching how a branch is just a pointer that moves forward with each commit. The last lesson creates a feature branch, fetches what changed on the remote and rebases the branch onto origin/main, which shows the difference between fetching new commits and moving your own work on top of them. As you type, the simulator shows files moving through the working directory, the staging area, the local repository, the branch pointers and the remote, so you can see what changed instead of trusting the output text.',
    teaches: [
      'Git working tree, staging area and commits',
      'git add, commit and push',
      'Branches as pointers',
      'Merging branches',
      'git fetch and git rebase',
    ],
    level: 'Beginner',
    tryThis: [
      'In "Stage & Commit", add a file, run git diff --staged and commit it, watching the staging area empty.',
      'In "Branch Pointers", create a branch, commit on it and switch back to main to see which pointer moved.',
      'Finish "Fetch & Rebase" by fetching and rebasing a feature branch onto origin/main.',
    ],
    faq: [
      {
        question: 'What is the Git staging area?',
        answer:
          'Also called the index, it is where you assemble the exact changes that the next commit will contain. git add puts changes there and git commit records them.',
      },
      {
        question: 'What is the difference between git fetch and git pull?',
        answer:
          'git fetch downloads new commits from the remote without changing your branches. git pull fetches and then merges (or rebases, if configured) them into your current branch.',
      },
      {
        question: 'Should I merge or rebase?',
        answer:
          'Merging keeps the existing commits: a merge of diverged branches creates a merge commit, and a fast-forward just moves the branch pointer. Rebasing rewrites your commits on top of the target for a straight history. Avoid rebasing commits that others have already pulled.',
      },
    ],
  },

  'javascript-promises-async-await-simulator': {
    summary:
      'JavaScript runs on one thread, so async code is about the order in which callbacks get their turn. This simulator makes that order visible. It shows the call stack, the runtime where timers wait, the promises, the microtask queue, the task queue and the console, and steps through short programs one action at a time. The first scenario shows why microtasks beat timers: a promise callback runs before a setTimeout callback with a zero delay, because the microtask queue drains completely before the next task starts. The second shows what await really does: the async function runs synchronously until the first await, then pauses while the outer script keeps going, and resumes later as a microtask. The third follows a rejected promise as it skips to catch while synchronous code still runs, with finally running for cleanup. The last shows Promise.all waiting for every input before it resolves. Once you can predict the console output, async bugs such as unexpected ordering become much easier to reason about.',
    teaches: [
      'The JavaScript event loop',
      'Microtasks and macrotasks',
      'Promises and async/await',
      'Promise error handling',
      'Promise.all',
    ],
    level: 'Intermediate',
    tryThis: [
      'Step through "Microtasks beat timers" and predict the console order before each step.',
      'Play "Await suspends the function" and watch run() pause at await while the outer script keeps logging.',
      'Open "Rejections jump to catch" to see the rejection skip ahead to catch and finally run last.',
    ],
    faq: [
      {
        question: 'Why does a promise callback run before setTimeout with 0 ms?',
        answer:
          'Promise callbacks are microtasks, and the event loop drains the whole microtask queue before it takes the next task. setTimeout callbacks are tasks, so they wait until the microtasks are done.',
      },
      {
        question: 'Does await block the thread?',
        answer:
          'No. await pauses only the async function it is in. The rest of the program keeps running, and the function resumes as a microtask when the awaited promise settles.',
      },
      {
        question: 'What happens if one promise in Promise.all rejects?',
        answer:
          'Promise.all rejects immediately with that reason and ignores the results of the others. Use Promise.allSettled when you need every result regardless of failures.',
      },
    ],
  },

  'oauth-oidc-flow-simulator': {
    summary:
      'OAuth 2.0 lets an application act on your behalf without ever seeing your password, and OpenID Connect adds a standard way to learn who you are. This simulator steps through the flows between the browser, the client application, the authorization server, the token endpoint and the API. The first flow is the authorization code flow with PKCE: the client builds an authorize URL, redirects you to log in and consent, receives a short-lived code and exchanges it, together with the PKCE verifier, for tokens. The second looks at what comes back: an ID token the client validates to create a session, an access token for calling the API or the UserInfo endpoint, and the claims inside them. The third covers scopes and refresh: asking for an API scope, an access token expiring and a refresh token getting a new one. The last shows failure modes, a mismatched redirect URI and a request for broader scopes than needed, and how to fix each. You come away knowing which token is for what.',
    teaches: [
      'OAuth 2.0 authorization code flow',
      'PKCE',
      'OpenID Connect ID tokens',
      'Access tokens, refresh tokens and scopes',
      'Redirect URI validation',
    ],
    level: 'Intermediate',
    tryThis: [
      'Step through "Auth Code + PKCE" and watch the code being exchanged for tokens at the token endpoint.',
      'Open "Tokens & Claims" and compare what the ID token and the access token are used for.',
      'In "Failure Modes", break the redirect URI and see the authorization server refuse it, then fix it.',
    ],
    faq: [
      {
        question: 'What is the difference between OAuth and OpenID Connect?',
        answer:
          'OAuth 2.0 is about authorization: getting an access token to call an API. OpenID Connect builds on it for authentication, adding an ID token that tells the client who the user is.',
      },
      {
        question: 'What is PKCE and why is it needed?',
        answer:
          'Proof Key for Code Exchange. The client sends a hash of a random secret with the authorize request and the secret itself when exchanging the code, so an intercepted authorization code is useless to anyone else. It is recommended for all clients, not only mobile apps.',
      },
      {
        question: 'Should an API accept the ID token?',
        answer:
          'No. The ID token is meant for the client to learn who logged in. APIs should require an access token issued for them, with the right audience and scopes.',
      },
    ],
  },

  'smtp-flow-simulator': {
    summary:
      'Sending an email from an application is a conversation between servers, and most delivery problems happen at a specific step of it. This simulator follows a message from your app through an SMTP relay to the recipient mail server and into the mailbox. In the successful scenario you watch the client open a submission connection, discover the server extensions with EHLO, upgrade to an encrypted connection with STARTTLS, authenticate, send the envelope sender and recipient, and stream the headers and body. The relay signs the message, the receiving side checks the sender identity with SPF, DKIM and DMARC, the relay looks up the recipient MX record and hands the message over, and it lands in the inbox. Two more scenarios show what goes wrong. In greylisting, the remote server asks for a retry, the relay queues the message and tries again with backoff, and the second attempt is accepted. In an authentication failure, a bad credential is rejected at submission and the message is never accepted at all. Each step shows whether the result is accepted, retry later or a permanent failure.',
    teaches: [
      'SMTP submission and relay',
      'EHLO, STARTTLS and SMTP AUTH',
      'SPF, DKIM and DMARC',
      'MX records',
      'Greylisting and retries',
    ],
    level: 'Beginner',
    tryThis: [
      'Play "Successful transactional email" and follow the message from the app to the mailbox, step by step.',
      'Switch to "Temporary greylisting retry" and watch the relay queue the message and retry with backoff.',
      'Run "Authentication failure" to see a bad credential stop the message before it is ever queued.',
    ],
    faq: [
      {
        question: 'What is the difference between ports 25, 587 and 465?',
        answer:
          'Port 25 is used between mail servers. Port 587 is for clients submitting mail, starting in plain text and upgrading with STARTTLS. Port 465 is submission over implicit TLS, encrypted from the first byte.',
      },
      {
        question: 'What do SPF, DKIM and DMARC do?',
        answer:
          'SPF lists the servers allowed to send for a domain, DKIM adds a cryptographic signature to each message, and DMARC tells receivers what to do when neither SPF nor DKIM passes in alignment with the visible From domain.',
      },
      {
        question: 'What is greylisting?',
        answer:
          'A spam defense where the receiving server temporarily rejects mail from an unknown sender with a 4xx code. A legitimate server retries later and is accepted, while many spam senders never retry.',
      },
    ],
  },

  'message-queue-simulator': {
    summary:
      'A message queue lets producers and consumers work at different speeds, but Kafka and RabbitMQ do it in different ways. This simulator lets you switch between a Kafka topic and a RabbitMQ exchange and run the same scenarios on both. In normal operation producers publish, the broker stores and routes, and consumers keep up. In consumer lag the consumers fall behind and the backlog grows, which is the number to watch in production. Rebalancing restarts a consumer every few ticks: in Kafka the group rebalances and stops consuming while partitions change owner, while RabbitMQ consumers keep going. Ordering guarantees shows that Kafka keeps order only within a partition, so messages for the same key must go to the same partition. Dead letter handling sends poison messages that fail every delivery; each one gets three delivery attempts before it moves to a dead letter queue, so it stops blocking everything behind it. Backpressure shows what happens when the broker or consumers cannot accept more. Seeing both systems handle the same situations makes the trade-off clear: Kafka is a replayable log split into partitions, while RabbitMQ routes messages to queues through exchanges and bindings.',
    teaches: [
      'Producers, brokers and consumers',
      'Kafka partitions and consumer groups',
      'RabbitMQ exchanges and bindings',
      'Consumer lag and backpressure',
      'Dead letter queues',
    ],
    level: 'Intermediate',
    tryThis: [
      'Run "Consumer lag" in Kafka mode and watch the backlog grow when consumers fall behind.',
      'Open "Ordering guarantees" to see why ordering holds only within a single Kafka partition.',
      'Run "Dead letter handling" and watch a poison message fail its retries, attempt 1, 2 and 3, before it lands in the dead letter queue.',
    ],
    faq: [
      {
        question: 'What is the difference between Kafka and RabbitMQ?',
        answer:
          'Kafka is a distributed log: messages are appended to partitions and kept for a retention period, so consumers can replay them. RabbitMQ is a broker that routes messages through exchanges to queues, and messages are usually removed once acknowledged.',
      },
      {
        question: 'What is consumer lag?',
        answer:
          'The difference between the newest message in a partition or queue and the last one a consumer has processed. Growing lag means consumers cannot keep up with producers.',
      },
      {
        question: 'What is a dead letter queue?',
        answer:
          'A queue where messages go after they fail processing too many times or expire. It keeps one bad message from blocking the rest, and lets you inspect and replay failures later.',
      },
    ],
  },

  'caching-simulator': {
    summary:
      'A cache keeps a small copy of data that is expensive to fetch, so most requests skip the slow path. This simulator puts a cache with room for four items in front of a database and lets you request data such as a user profile, a product list, settings, a dashboard, messages or analytics. Each request either hits the cache and returns immediately, or misses, fetches from the database, stores the result and returns it, and the hit rate and the time saved update as you go. When the cache is full, it has to evict something, and you can choose how: LRU removes the item used least recently, FIFO removes the oldest item, and LFU removes the item used least often. Requesting the same keys in different patterns shows how the policies differ, for example how one scan of rarely used items can push frequently used ones out under LRU but not under LFU. The explanation below the simulator also covers write strategies, write-through, write-back and write-around, and why every cache needs an expiry or invalidation plan.',
    teaches: [
      'Cache hits and misses',
      'LRU, LFU and FIFO eviction',
      'Cache-aside pattern',
      'Write-through and write-back caching',
    ],
    level: 'Beginner',
    tryThis: [
      'With the LRU policy, request five different items and watch which one is evicted when the cache is full.',
      'Select LFU first, request the same item several times, then request enough different items to fill the cache and see which entries survive.',
      'Compare the hit rate and the time saved after the same sequence of requests under LRU, FIFO and LFU.',
    ],
    faq: [
      {
        question: 'What is the difference between LRU and LFU?',
        answer:
          'LRU (least recently used) evicts the item that has gone longest without being accessed. LFU (least frequently used) evicts the item with the fewest accesses, so popular items survive a burst of one-off requests.',
      },
      {
        question: 'What is the cache-aside pattern?',
        answer:
          'The application checks the cache first, and on a miss reads from the database and writes the result into the cache. It is the most common pattern with Redis or Memcached.',
      },
      {
        question: 'What is the difference between write-through and write-back?',
        answer:
          'Write-through writes to the cache and the database at the same time, which is safe but slower. Write-back writes to the cache first and to the database later, which is faster but can lose data if the cache fails.',
      },
    ],
  },

  'deployment-strategies': {
    summary:
      'How you release a new version decides how many users a bad release reaches and how fast you can undo it. This simulator plays four common strategies step by step, so you can compare them on the same three-pod application. Recreate stops the old version and then starts the new one, which is simple but causes downtime. A rolling update starts a new pod, waits until it is ready, removes an old one and repeats, so capacity stays up while versions run side by side. Blue-green deploys the new version next to the old one, waits until it is ready and then switches all traffic at once, which makes rollback a single switch back. Canary sends a small share of traffic, 10 percent here, to the new version, observes the metrics, raises it to 50 percent, checks again and only then rolls out fully, so a bad release reaches few users. The trade-offs are cost, speed and risk: blue-green needs double capacity, canary needs good metrics, and recreate needs a maintenance window.',
    teaches: [
      'Recreate deployments',
      'Rolling updates',
      'Blue-green deployments',
      'Canary releases',
      'Rollback strategies',
    ],
    level: 'Beginner',
    tryThis: [
      'Step through "Recreate" and note the moment when no version is running.',
      'Compare "Rolling Update" and "Blue-Green" to see when old and new pods serve traffic at the same time.',
      'Step through "Canary" and stop at the 10 percent stage, where you would check metrics before going further.',
    ],
    faq: [
      {
        question: 'What is the difference between blue-green and canary deployments?',
        answer:
          'Blue-green switches all traffic from the old environment to the new one at once and can switch back instantly. Canary moves traffic gradually, starting with a small share, so problems affect fewer users but the rollout takes longer.',
      },
      {
        question: 'Which deployment strategy does Kubernetes use by default?',
        answer:
          'RollingUpdate. A Deployment replaces pods gradually, controlled by maxSurge and maxUnavailable. Recreate is the other built-in option; blue-green and canary need extra tooling or manual steps.',
      },
      {
        question: 'When is a recreate deployment acceptable?',
        answer:
          'When brief downtime is acceptable, or when two versions cannot run at the same time, for example because of an incompatible database migration or a single-writer resource.',
      },
    ],
  },

  'rest-vs-graphql': {
    summary:
      'REST and GraphQL are two ways to design an API, and the difference shows up most clearly when a screen needs data from several places. This simulator runs the same data needs against both styles and shows the requests that travel and the data that comes back. In a simple fetch the two look much alike. With nested data, such as a user and their posts, REST needs a second request. With related data, such as the comments on each post, the number of REST requests grows with every post, the N+1 problem, while one GraphQL query asks for exactly the nested fields. REST also tends to over-fetch, returning whole objects when the screen needs two fields. GraphQL avoids both by letting the client describe the shape of the response. The trade-offs run the other way too: GraphQL moves complexity to the server, makes HTTP caching harder and needs limits on query depth, while REST stays simple to cache and reason about. The goal is to pick the right tool for each API rather than a winner.',
    teaches: [
      'REST API design',
      'GraphQL queries',
      'Over-fetching and under-fetching',
      'Choosing between REST and GraphQL',
    ],
    level: 'Beginner',
    tryThis: [
      'Run "Simple Fetch" in both styles and compare the requests and payloads.',
      'Switch to "Related Data" and count the REST requests, one more for every post, compared with a single GraphQL query.',
      'Use "Multiple Resources" to see over-fetching in REST responses next to the fields GraphQL returns.',
    ],
    faq: [
      {
        question: 'What is over-fetching?',
        answer:
          'Getting more data than the client needs, such as a full user object when the screen only shows a name. It wastes bandwidth and is common with fixed REST endpoints.',
      },
      {
        question: 'Is GraphQL faster than REST?',
        answer:
          'Not inherently. GraphQL can reduce round trips and payload size, but a complex query can be expensive to resolve on the server, and REST responses are easier to cache over HTTP.',
      },
      {
        question: 'When should I choose REST over GraphQL?',
        answer:
          'When the API is resource oriented, clients are simple or public, and HTTP caching matters. GraphQL fits best when many clients need different shapes of the same related data.',
      },
    ],
  },

  'scaling-simulator': {
    summary:
      'Scaling is how a system keeps serving requests as traffic grows, and each approach has a different cost in money, downtime and complexity. In this simulator you run a small service against a traffic scenario and decide how to keep it up. Vertical scaling upgrades the server to a bigger size, which is simple but causes downtime during the change and eventually hits a ceiling. Horizontal scaling adds more servers behind a load balancer, which spreads the load and removes the single point of failure. Autoscaling adds and removes servers automatically when CPU passes a threshold, within a minimum and maximum, with delays before scaling up and down. Four scenarios test your choices: gradual growth, a sudden spike, variable load and a Black Friday surge. The simulator tracks failed requests, response time, uptime and the cost of the servers you run, so the goal is not only to survive the traffic but to do it on a budget. Over-provisioning wins easily but costs too much; reacting too slowly drops requests.',
    teaches: [
      'Vertical scaling',
      'Horizontal scaling and load balancing',
      'Autoscaling thresholds and delays',
      'Capacity planning and cost',
    ],
    level: 'Beginner',
    tryThis: [
      'Run "Sudden Spike" with one server and no load balancer, then try again after upgrading the server to see the downtime vertical scaling causes.',
      'Add a load balancer and more servers, then compare failed requests and cost with the vertical approach.',
      'Add a load balancer, turn on autoscaling for "Black Friday" and tune the CPU threshold and the minimum and maximum instances to stay within budget.',
    ],
    faq: [
      {
        question: 'What is the difference between vertical and horizontal scaling?',
        answer:
          'Vertical scaling makes one server bigger with more CPU or memory. Horizontal scaling adds more servers and spreads traffic across them, which also improves availability.',
      },
      {
        question: 'How does autoscaling decide when to add servers?',
        answer:
          'It watches a metric such as average CPU or requests per second and adds instances when it stays above a target, within configured minimum and maximum counts. Cooldowns or delays stop it from flapping.',
      },
      {
        question: 'Why does autoscaling not prevent every outage during a spike?',
        answer:
          'New instances take time to start and warm up. A sharp spike can overload the existing servers before the new ones are ready, which is why teams pre-scale for known events.',
      },
    ],
  },

  'bcdr-simulator': {
    summary:
      'Business continuity and disaster recovery planning comes down to two numbers. The recovery point objective, RPO, is how much data you can afford to lose, measured back from the moment of failure. The recovery time objective, RTO, is how long you can afford to be down. This simulator plays a disaster against a running business and lets you choose the backup strategy in advance: a hot site that runs continuously and takes over almost at once, a warm site that is partly running and needs some time to scale up, or a cold site that has to be built and restored from backups after the disaster. The story moves through normal operations, the moment disaster strikes, customers unable to reach the service, the backup systems being activated and the business coming back online, then explains the data lost and the downtime your choice produced. The comparison makes the trade-off concrete: a lower RPO and RTO cost more every month, so the right strategy depends on what an hour of downtime or of lost data costs the business.',
    teaches: [
      'Disaster recovery planning',
      'Recovery point objective (RPO)',
      'Recovery time objective (RTO)',
      'Hot, warm and cold sites',
    ],
    level: 'Beginner',
    tryThis: [
      'Choose a cold backup, play the disaster through and note the data loss and downtime at the end.',
      'Replay with a hot backup and compare the RPO and RTO figures in the summary.',
      'Try the warm backup and decide whether its middle ground would fit a business you know.',
    ],
    faq: [
      {
        question: 'What is the difference between RPO and RTO?',
        answer:
          'RPO is the maximum acceptable data loss, measured in time before the failure, and the business sets it; backup frequency and replication are then chosen to meet it. RTO is the maximum acceptable downtime, measured from the failure until service is restored.',
      },
      {
        question: 'What is the difference between hot, warm and cold disaster recovery sites?',
        answer:
          'A hot site runs a live copy and can take over almost immediately. A warm site has infrastructure ready but needs data restored or capacity scaled. A cold site is little more than space or an account that must be built out after the disaster.',
      },
      {
        question: 'How often should a disaster recovery plan be tested?',
        answer:
          'Regularly, at least once a year and after major changes. An untested backup is not a recovery plan, because restores often fail on missing steps, credentials or dependencies.',
      },
    ],
  },

  'ssl-tls-handshake': {
    summary:
      'Before a browser sends anything over HTTPS, it and the server run a TLS handshake to agree on keys and prove the server identity. This simulator animates that handshake message by message for both TLS 1.2 and TLS 1.3. In TLS 1.2 you see ClientHello, ServerHello, the certificate, the key exchange, ChangeCipherSpec and Finished across two round trips. In TLS 1.3 the client sends its key share in the first message, the server replies with its key share, encrypted extensions and certificate, and the connection is ready after a single round trip. You can open the certificate chain to see how a server certificate is signed by an intermediate CA that chains to a root CA the client already trusts. Failure scenarios show what makes a browser stop with a warning: an expired certificate, a hostname that does not match the certificate, a weak cipher and a certificate from an untrusted CA. Knowing which step fails is what lets you fix a TLS error quickly instead of guessing.',
    teaches: [
      'TLS handshake',
      'TLS 1.2 versus TLS 1.3',
      'Certificate chains and certificate authorities',
      'Common TLS errors',
    ],
    level: 'Intermediate',
    tryThis: [
      'Play the handshake in TLS 1.2, then switch to TLS 1.3 and compare the number of round trips.',
      'Open the certificate chain view to see the server certificate, the intermediate CA and the root CA.',
      'Pick the "Hostname Mismatch" and "Expired Certificate" scenarios and see where the handshake fails.',
    ],
    faq: [
      {
        question: 'What is the difference between TLS 1.2 and TLS 1.3?',
        answer:
          'TLS 1.3 completes the handshake in one round trip instead of two, encrypts more of the handshake, and removes older, weaker algorithms such as static RSA key exchange.',
      },
      {
        question: 'What is a certificate chain?',
        answer:
          'The path from the server certificate through one or more intermediate certificates to a root CA that the client trusts. Servers must send the intermediates, or some clients cannot build the chain.',
      },
      {
        question: 'What causes a certificate hostname mismatch error?',
        answer:
          'The name in the address bar does not appear in the certificate subject alternative names, for example a certificate for example.com used on www.example.com or on a different domain.',
      },
    ],
  },

  'load-balancer-simulator': {
    summary:
      'A load balancer spreads incoming requests across several servers, and the algorithm it uses decides how even that spread is. This simulator sends a stream of requests to three servers and lets you compare four algorithms. Round robin sends each request to the next server in turn. Least connections sends it to the server with the fewest active requests, which helps when some requests take longer than others. IP hash sends the same client to the same server every time, which gives sticky sessions but can pile one network of clients onto one server. Random picks a server by chance. You can change the traffic rate from slow to burst, take servers out of service, set a failure rate and turn retries on or off, then watch how many requests each server handles and how many fail. The lesson is that no algorithm is best for every case: round robin is fine for uniform requests, least connections handles uneven work better, and session affinity is a trade-off you choose deliberately, ideally avoided by keeping sessions out of the server.',
    teaches: [
      'Load balancing algorithms',
      'Round robin and least connections',
      'Sticky sessions with IP hash',
      'Health checks and retries',
    ],
    level: 'Beginner',
    tryThis: [
      'Run round robin at the normal rate, then switch to least connections and compare how evenly the three servers are loaded.',
      'Take one server out of service and watch the load balancer route around it.',
      'Set the failure rate to high and toggle retries to see how many failed requests retries can save.',
    ],
    faq: [
      {
        question: 'What is the difference between round robin and least connections?',
        answer:
          'Round robin rotates through servers regardless of their load. Least connections picks the server with the fewest active requests, so it adapts when some requests take much longer than others.',
      },
      {
        question: 'What are sticky sessions?',
        answer:
          'Session affinity: the load balancer keeps sending a client to the same server, using a cookie or a hash of the client IP. It helps apps that keep session state in memory, at the cost of uneven load and harder failover.',
      },
      {
        question: 'Layer 4 or layer 7 load balancing: what is the difference?',
        answer:
          'A layer 4 load balancer routes TCP or UDP connections by address and port. A layer 7 load balancer understands HTTP, so it can route by host, path or header, terminate TLS and retry individual requests.',
      },
    ],
  },

  'dbms-simulator': {
    summary:
      'There is no single best database, only the best fit for a workload, and this simulator is a guided tour of the main families. The explorer covers six types side by side: relational databases with tables, SQL and ACID transactions; document databases that store JSON-like documents; key-value stores built for fast lookups by key; column-family stores designed for very large write-heavy datasets; graph databases that store relationships as first-class data; and time-series databases optimized for timestamped measurements. For each one you see how data is modeled, an example of how it is queried, and the workloads it suits. A decision playground then asks a few questions, such as whether you need ACID transactions or complex relationships, and points you to a matching type. The quiz closes with realistic scenarios: a financial system that needs transactions, session data with fast lookups and expiry, friend recommendations in a social network and millions of sensor readings. The aim is to choose a database from the access pattern, not from habit.',
    teaches: [
      'Relational versus NoSQL databases',
      'Document, key-value, column-family, graph and time-series databases',
      'ACID transactions',
      'Choosing a database for a workload',
    ],
    level: 'Beginner',
    tryThis: [
      'Open the explorer and compare how the relational and document databases model the same data.',
      'Use the decision playground to see which database type it recommends for your own project.',
      'Take the quiz and check the explanation for the IoT sensor scenario.',
    ],
    faq: [
      {
        question: 'When should I use a NoSQL database instead of SQL?',
        answer:
          'When the data model or scale fits it better: documents for flexible, self-contained records, key-value for simple fast lookups, graphs for heavily connected data and time-series stores for timestamped metrics. For most business data with relationships and transactions, a relational database is a safe default.',
      },
      {
        question: 'What does ACID mean?',
        answer:
          'Atomicity, consistency, isolation and durability: a transaction either fully happens or not at all, keeps the data valid, does not see half-finished work from others, and survives a crash once committed.',
      },
      {
        question: 'What is a time-series database?',
        answer:
          'A database optimized for data points with timestamps, such as metrics and sensor readings. It handles high write rates, compresses data well and makes time-window queries and retention policies efficient.',
      },
    ],
  },

  'gitops-workflow': {
    summary:
      'GitOps treats a Git repository as the single source of truth for what should run in a cluster, and an operator such as Argo CD or Flux keeps the cluster matching it. This simulator lets you watch that loop. You create commits, deploy one, and follow the change as it moves from Git to the GitOps operator and from the operator to Kubernetes, with the sync and health status updating along the way. You can switch automatic sync on and off to see the difference between an operator that applies every commit and one that waits for a manual sync. A drift scenario changes the live cluster by hand, the way a quick kubectl edit would, and shows the operator detecting that the cluster no longer matches Git. Three challenges then ask what a GitOps operator should do about configuration drift, what the GitOps way to roll back is, and which sync policy suits critical production workloads. The core idea is that changes reach production through Git commits, so history, review and rollback all come from the repository.',
    teaches: [
      'GitOps principles',
      'Argo CD and Flux style reconciliation',
      'Configuration drift detection',
      'Automatic versus manual sync',
      'Rollback through Git',
    ],
    level: 'Intermediate',
    tryThis: [
      'Create a new commit and deploy it, following the change from Git to the operator to Kubernetes.',
      'Turn automatic sync off, run the drift scenario and use the manual sync to bring the cluster back in line.',
      'Answer the "Deployment Rollback" challenge and compare it with how you roll back today.',
    ],
    faq: [
      {
        question: 'What is GitOps?',
        answer:
          'A way of operating infrastructure where the desired state lives in Git and an automated operator continuously reconciles the running system to match it. Changes are made through commits and pull requests, not direct commands.',
      },
      {
        question: 'What is configuration drift?',
        answer:
          'A difference between the live system and its declared configuration, usually caused by manual changes. GitOps operators detect it and can revert the change automatically.',
      },
      {
        question: 'How do you roll back in GitOps?',
        answer:
          'Revert the commit in Git, or point the application back to a known good revision. The operator then syncs the cluster to that state, and the rollback is recorded in history like any other change.',
      },
    ],
  },

  'tcp-vs-udp': {
    summary:
      'TCP and UDP both carry data over IP, but they make opposite promises. This simulator sends packets between two hosts so you can watch the difference. In TCP mode the connection starts with the three-way handshake, SYN, SYN-ACK and ACK, then every data packet is acknowledged and anything lost is sent again, so all data arrives in order at the cost of extra round trips. In UDP mode packets are simply sent, with no handshake, no acknowledgements and no retransmission, so whatever is lost stays lost. You can change the simulation speed, add packet loss and add jitter, which gives each packet its own delay so later packets can overtake earlier ones. UDP hands them over out of order, while TCP holds an early packet until the gap before it is filled, and the counters show packets sent, received, lost, retransmitted and out of order. With loss turned up, TCP slows down as it retransmits, while UDP keeps sending at the same rate and drops data. That is why TCP is used where every byte matters, such as web pages, APIs and file transfers, and UDP where fresh data matters more than complete data, such as DNS queries, video calls, games and QUIC, which builds its own reliability on top of UDP.',
    teaches: [
      'TCP three-way handshake',
      'Acknowledgements and retransmission',
      'UDP datagrams',
      'Packet loss and retransmission',
      'Jitter, packet reordering and head-of-line blocking',
    ],
    level: 'Beginner',
    tryThis: [
      'Start in TCP mode and watch the three-way handshake before any data is sent.',
      'Raise packet loss and compare the retransmit counter in TCP mode with the lost counter in UDP mode.',
      'Turn jitter up to 100% and compare the out-of-order counter in UDP mode with the held count in TCP mode, where early packets wait for the missing one.',
    ],
    faq: [
      {
        question: 'What is the difference between TCP and UDP?',
        answer:
          'TCP is connection oriented: it sets up a connection, acknowledges data, retransmits losses and delivers bytes in order. UDP sends independent datagrams with no delivery or ordering guarantees, which makes it lighter and lower latency.',
      },
      {
        question: 'Why does DNS use UDP?',
        answer:
          'Most DNS queries fit in one small request and response, so a connection setup would double the time. DNS falls back to TCP for large responses and zone transfers.',
      },
      {
        question: 'What is the TCP three-way handshake?',
        answer:
          'The client sends SYN, the server replies with SYN-ACK and the client answers ACK. After these three messages both sides have agreed on starting sequence numbers and can send data.',
      },
    ],
  },

  'microservices-simulator': {
    summary:
      'A microservices architecture splits an application into small services that each own one job and talk over the network. This simulator models a small shop built that way: an API gateway in front of user, product, cart and order services. When you start the simulation, calls travel between the services, and each service shows its CPU, memory, latency and status, healthy, degraded or down. A degraded or down service lowers the success rate of the calls that involve it, and the failures add up in the overall request counters, which makes the main cost of microservices visible: every network call is a new way to fail. Each service gets a fixed share of the traffic and each instance handles a set amount, so clicking a service shows its load as a share of capacity. The user service starts overloaded, with high CPU, slow responses and failing calls; scaling it up spreads the same load over more instances until it recovers, and scaling a busy service down does the opposite. A short tutorial walks you through it, and the notes below cover when a modular monolith is the better choice.',
    teaches: [
      'Microservices architecture',
      'API gateways',
      'Service-to-service calls',
      'Service health and failure propagation',
      'Horizontal scaling and capacity',
    ],
    level: 'Beginner',
    tryThis: [
      'Follow the tutorial: select a service, start the simulation and scale the service.',
      'Start the simulation and watch the overall request totals as calls travel between the services.',
      'Select the user service, which starts overloaded, and scale it up until its load drops below capacity and the success rate recovers.',
    ],
    faq: [
      {
        question: 'What is an API gateway?',
        answer:
          'A single entry point in front of your services that routes requests to the right one and handles shared concerns such as authentication, rate limiting and TLS termination.',
      },
      {
        question: 'When should you avoid microservices?',
        answer:
          'When the team is small, the domain is not yet well understood or the system is simple. Microservices add network failures, distributed debugging and deployment overhead, so a modular monolith is often the better start.',
      },
      {
        question: 'How do you stop one failing service from taking down the others?',
        answer:
          'Use timeouts on every call, retries with backoff, circuit breakers that stop calling a failing service, and fallbacks, so a dependency failure degrades one feature instead of the whole request.',
      },
    ],
  },

  'k8s-scheduler': {
    summary:
      'The Kubernetes scheduler decides which node each pod runs on, and most pods stuck in Pending are there because no node satisfies their constraints. In this simulator you play the scheduler yourself: drag each pod onto a node and the game tells you when a placement breaks a rule. Four levels add one kind of constraint at a time. The first is resource requests: a node can only take pods whose CPU and memory requests fit in what it has left, whatever the pods actually use. The second adds taints and tolerations for dedicated nodes, such as a GPU node that only accepts pods that tolerate its taint, and pod anti-affinity that keeps replicas apart. The third adds node selectors and node affinity, which steer pods toward nodes with particular labels. The fourth spreads replicas evenly across zones with topology spread constraints, so losing one zone does not take every replica with it. Placing pods by hand under a timer makes the filtering and scoring steps that the real scheduler runs feel concrete.',
    teaches: [
      'Kubernetes pod scheduling',
      'Resource requests and limits',
      'Taints and tolerations',
      'Node affinity and anti-affinity',
      'Topology spread constraints',
    ],
    level: 'Intermediate',
    tryThis: [
      'In "Level 1: Requests & Limits", place the pods and see which node runs out of requested CPU or memory first.',
      'In Level 2, try to drop an ordinary pod on the GPU node and read why the taint rejects it.',
      'In Level 4, spread the api replicas across zones and see what breaks the topology spread rule.',
    ],
    faq: [
      {
        question: 'Why is my Kubernetes pod stuck in Pending?',
        answer:
          'Usually because no node satisfies its constraints: not enough unrequested CPU or memory, a taint the pod does not tolerate, a node selector or affinity that matches no node, or a missing persistent volume. kubectl describe pod shows the scheduler message.',
      },
      {
        question: 'What is the difference between requests and limits?',
        answer:
          'Requests are what the scheduler reserves when placing a pod. Limits are the ceiling enforced at runtime: exceeding a memory limit gets the container killed, and CPU above the limit is throttled.',
      },
      {
        question: 'What are taints and tolerations?',
        answer:
          'A taint on a node repels pods, and a toleration on a pod allows it onto nodes with a matching taint. They are used to reserve nodes, such as GPU nodes, for specific workloads.',
      },
    ],
  },

  'rate-limit-simulator': {
    summary:
      'APIs limit how many requests a client can make in a time window, and how your client reacts to hitting that limit decides whether it recovers or makes things worse. This simulator sends requests to a rate-limited API and shows the remaining quota, the time until the window resets and every 429 Too Many Requests response. You can pick a preset modeled on a popular API or a short demo window, send bursts of requests of a chosen size and interval, and compare three client strategies. With no backoff, the client keeps retrying immediately and burns through failures. A fixed delay waits the same time after each failure, which helps but can still hit the limit again in lockstep with other clients. Exponential backoff doubles the wait after each failure, which spreads retries out and gives the server room to recover. The notes cover the details that matter in production: honoring the Retry-After header, adding jitter so many clients do not retry at the same instant, and reading the rate limit headers to slow down before you are refused.',
    teaches: [
      'API rate limiting',
      'HTTP 429 and Retry-After',
      'Exponential backoff',
      'Retry jitter',
    ],
    level: 'Beginner',
    tryThis: [
      'Use the demo preset with no backoff and send bursts until the 429 responses start.',
      'Switch to fixed delay and then to exponential backoff and compare how many requests fail.',
      'Increase the burst size and watch how fast the remaining quota drops before the window resets.',
    ],
    faq: [
      {
        question: 'What does HTTP 429 mean?',
        answer:
          'Too Many Requests: the client has sent more requests than the server allows in a period. The response often includes a Retry-After header saying how long to wait.',
      },
      {
        question: 'What is exponential backoff?',
        answer:
          'A retry strategy where the wait doubles after each failure, for example 1, 2, 4 and 8 seconds, usually with a maximum. It stops a struggling server from being flooded by retries.',
      },
      {
        question: 'Why add jitter to retries?',
        answer:
          'Without jitter, clients that failed at the same moment retry at the same moment and collide again. A random offset spreads the retries out.',
      },
    ],
  },

  'ddos-simulator': {
    summary:
      'A distributed denial of service attack tries to make a service unavailable by flooding it with more traffic than it can handle. This simulator puts you in charge of defending a server against waves of attack traffic of increasing intensity. You can choose the attack type: an HTTP flood that sends application requests, a SYN flood that opens TCP connections and never completes them, or a UDP flood that saturates bandwidth with datagrams. As the attack runs, the server health drops with the load and the counters show requests per second, total requests and how many were blocked. You defend with layers: a firewall that filters traffic, a load balancer that spreads it, and automatic rate limiting that throttles clients sending too much. The firewall and the rate limiter block part of the attack, the load balancer reduces the damage from what gets through, and survival time, waves and achievements reward a setup that holds. The point is that no single control stops every kind of flood, so real protection combines filtering, rate limiting, spare capacity and, for large attacks, an upstream mitigation service or CDN.',
    teaches: [
      'DDoS attack types',
      'HTTP, SYN and UDP floods',
      'Rate limiting and traffic filtering',
      'Layered DDoS defense',
    ],
    level: 'Beginner',
    tryThis: [
      'Start an HTTP flood with no defenses and watch how quickly the server health falls.',
      'Turn on the firewall, the load balancer and automatic rate limiting one at a time and compare the blocked request counts.',
      'Switch to a SYN flood or UDP flood and see which defenses still help.',
    ],
    faq: [
      {
        question: 'What is the difference between a DoS and a DDoS attack?',
        answer:
          'A denial of service attack comes from one source, which can often be blocked. A distributed attack comes from many machines, often a botnet, so blocking single addresses does not stop it.',
      },
      {
        question: 'What is a SYN flood?',
        answer:
          'An attack that sends many TCP SYN packets without completing the handshake, filling the server table of half-open connections. SYN cookies and upstream filtering are common defenses.',
      },
      {
        question: 'Does rate limiting stop DDoS attacks?',
        answer:
          'It helps against application-layer floods from a limited set of clients, but large volumetric attacks saturate the network before your server sees them. Those need upstream protection, such as a CDN or a scrubbing service.',
      },
    ],
  },

  'packet-journey': {
    summary:
      'Loading a web page is a chain of steps across several systems, and knowing the chain helps you find where a slow or failing request is stuck. This simulator follows a request from the browser to the database and back. It starts with DNS resolution to find the address, then the TCP handshake, then, for HTTPS, the TLS handshake. The request may stop at a CDN edge, pass through a load balancer, reach a web server, be handled by the application and trigger a database query, and the response travels back the same way. Four scenarios compare the paths: plain HTTP, HTTPS, HTTPS through a CDN, and HTTPS with the response already cached at the CDN, where the request never reaches your servers at all. Seeing the steps one after another shows where the time goes, why TLS adds round trips, and why a CDN cache hit is so much faster than a full trip to the origin. It is a useful mental model for the classic interview question about what happens when you type a URL.',
    teaches: [
      'The path of an HTTP request',
      'DNS, TCP and TLS setup',
      'CDNs and edge caching',
      'Load balancers and application servers',
    ],
    level: 'Beginner',
    tryThis: [
      'Run "Basic HTTP" and then "HTTPS" to see the extra TLS handshake step.',
      'Run "HTTPS + CDN" and follow the request from the edge to the origin and back.',
      'Compare it with "HTTPS + CDN (Cached)", where the edge answers without contacting the origin.',
    ],
    faq: [
      {
        question: 'What happens when you type a URL into a browser?',
        answer:
          'The browser resolves the domain with DNS, opens a TCP connection, negotiates TLS for HTTPS, sends the HTTP request, which may pass through a CDN and load balancer to an application, and renders the response.',
      },
      {
        question: 'How does a CDN make a site faster?',
        answer:
          'It serves cached copies from edge locations close to users, which shortens the network distance and spares the origin. On a cache miss the edge fetches from the origin and may keep the result for later requests.',
      },
      {
        question: 'Why is HTTPS slower to connect than HTTP?',
        answer:
          'A new TLS connection adds a handshake before the request can be sent: one round trip with TLS 1.3, two with TLS 1.2. Connection reuse and TLS 1.3 resumption keep that cost small.',
      },
    ],
  },

  'incident-commander-simulator': {
    summary:
      'During an outage the incident commander does not fix things alone: they decide what to investigate, which mitigation to try and what to tell people, while the clock and the impact keep moving. This simulator puts you in that role. Each turn you choose to investigate, mitigate or communicate. Investigating opens real-looking evidence, such as API logs for failed checkout requests, database connection counts, traffic against capacity and replication health. Mitigations range from the one that fixes the cause to tempting ones that cost time or make things worse, such as raising max_connections, which restarts the production database, or restarting every API pod, which does not change how many connections the pods ask for. The first scenario is a launch day where too many clients exhaust the database connections; the second has a deploy, a feature flag change and a node upgrade landing within five minutes before checkout breaks. At the end, an incident review shows what your choices cost. The core habit it trains is to mitigate first and diagnose second, while keeping stakeholders informed instead of going silent.',
    teaches: [
      'Incident command',
      'Mitigation before diagnosis',
      'Incident communication',
      'Database connection pool exhaustion',
      'Post-incident review',
    ],
    level: 'Intermediate',
    tryThis: [
      'Play "Launch day: too many clients" and investigate the failing checkout requests before choosing a mitigation.',
      'Try raising max_connections and read why the database restart it needs makes the outage worse.',
      'Finish a scenario and open the incident review to compare your choices with the best path.',
    ],
    faq: [
      {
        question: 'What does an incident commander do?',
        answer:
          'They coordinate the response: set priorities, assign investigation and mitigation work, make decisions and keep communication flowing. They usually avoid hands-on debugging so they can see the whole picture.',
      },
      {
        question: 'Why mitigate before you find the root cause?',
        answer:
          'Users are affected while you investigate. Rolling back, failing over or shedding load often restores service quickly, and the root cause can be found afterwards with less pressure.',
      },
      {
        question: 'What should a post-incident review cover?',
        answer:
          'A timeline, the impact, what helped and what slowed the response, contributing causes and action items with owners. It should be blameless so people report what really happened.',
      },
    ],
  },

  'on-call': {
    summary:
      'Most on-call work is reading signals under pressure. A page fires, an error rate jumps, and you have to choose which logs, metrics and commands to check before you name a cause. On-Call: The Daily Incident turns that into a daily puzzle. Every day, everyone gets the same production incident: the alert that paged you and a few symptoms. You have six moves. Opening a signal, such as kubectl output, a Postgres query, dig, curl, openssl or a load balancer log, costs one move, and naming a cause costs one move too. Green means you found the root cause, yellow means the cause is in the right area but did not cause this incident, and grey means the wrong area. After the round you see what happened and how to stop it happening again. The incidents cover Kubernetes, DNS, TLS certificates, databases, CI/CD, cloud networking, memory, cron and time zones, rate limits, caches, queues, feature flags, and deploys and rollbacks. The habit it trains is to gather the right evidence before you guess, and to tell a symptom apart from its cause.',
    teaches: [
      'Incident triage',
      'Root cause analysis',
      'Reading logs, metrics and command output',
      'Kubernetes and database troubleshooting',
      'DNS, TLS and network debugging',
    ],
    level: 'Intermediate',
    tryThis: [
      'Read the page and the symptoms, then open only the signal that would best prove or rule out your first idea before you name a cause.',
      'If a cause comes back yellow, use the area it names to narrow your next pick instead of guessing again.',
      'Finish the round, open "Review every signal" to see the evidence you skipped, then copy your spoiler-free result with Share result.',
    ],
    faq: [
      {
        question: 'How does the daily incident work?',
        answer:
          'Everyone gets the same incident on the same UTC day, and a new one starts at 00:00 UTC. You have six moves: each signal you open and each cause you name uses one.',
      },
      {
        question: 'What do the colors mean?',
        answer:
          'Green is the root cause. Yellow is a cause in the same area as the root cause, for example another database problem, but not the one behind this incident. Grey is a cause in a different area. A magnifying glass marks a move spent on a signal.',
      },
      {
        question: 'Where is my streak stored?',
        answer:
          'Only in your browser. There is no account. Under "Stats and streak backup" you can copy a short backup code, then paste it later to get your streak back after clearing your browser or on another device.',
      },
      {
        question: 'Are the incidents real?',
        answer:
          'They are made up, but each one is built from a failure that teams hit in production, such as connection pool exhaustion, an expired certificate, a DNSSEC mistake or a replication slot that fills a disk. The signals are written to look like real command output.',
      },
    ],
  },

  'terraform-puzzle': {
    summary:
      'Most Terraform trouble is not about writing resources, it is about state: what Terraform thinks exists compared with what really does. This puzzle game gives you real situations to untangle. A plan wants to build production again because you are in the wrong workspace. A tidy-up rename makes Terraform want to destroy and recreate a database. Someone deleted an alarm by hand. A state lock will not go away. An apply was killed halfway. A database built by hand needs to be adopted, and staging has to be retired without touching production. For each one you inspect the evidence, such as the workspace list, the state, the plan and the pull request diff, then pick a fix. Answers are graded as the best fix, a fix that works with a catch, a safe step that does not finish the job, or an unsafe action that does damage, and you see the plan each choice would produce. The recurring lesson is to prefer declarative blocks in code, such as moved, import and removed, over one-off state commands, so the fix is reviewed and repeatable.',
    teaches: [
      'Terraform state',
      'Workspaces',
      'moved, import and removed blocks',
      'State locking',
      'Safe refactoring of Terraform code',
    ],
    level: 'Advanced',
    tryThis: [
      'Open "Plan wants to build production again" and check which workspace you are in before you apply anything.',
      'Solve "The tidy-up rename" with a moved block and compare it with simply applying the plan.',
      'Try "Adopt the hand-made database" and see why an import is safer than letting Terraform create a new one.',
    ],
    faq: [
      {
        question: 'What does a moved block do in Terraform?',
        answer:
          'It tells Terraform that a resource address changed, for example after a rename or a move into a module, so it updates the state instead of destroying the old resource and creating a new one.',
      },
      {
        question: 'How do I bring an existing resource under Terraform management?',
        answer:
          'Use an import block in your configuration (Terraform 1.5 and later) or terraform import, with matching resource code. Then plan to confirm there are no unexpected changes.',
      },
      {
        question: 'What should I do about a stuck Terraform state lock?',
        answer:
          'First make sure no other run is actually in progress. Only then remove it with terraform force-unlock and the lock ID, because breaking a lock during a real apply can corrupt the state.',
      },
    ],
  },

  'docker-escape': {
    summary:
      'A container is not a security boundary by default, and most container escapes come from a single flag rather than a kernel exploit. This challenge shows six real docker run commands, each the kind of thing people ship because a tutorial said so: a CI runner, an "it did not work so I added this" container, a backup job, a monitoring agent, one that looks careful, and a final one. Each command is split into tokens, and you click the ones you think give an attacker the host. Then you see the actual escape path for each dangerous token and the safer fix. The cases include mounting the Docker socket, which is equivalent to root on the host because the daemon runs as root; --privileged, which hands the container nearly every capability and access to host devices; sharing the host process namespace with --pid=host; and capabilities such as SYS_ADMIN and SYS_PTRACE. The careful-looking scenario shows that swapping --privileged for --cap-add=SYS_ADMIN with an unconfined AppArmor profile is not much safer, and the last one is a hardened command with --read-only, --cap-drop=ALL, no-new-privileges, a narrow read-only mount and a non-root user, so you also learn to recognize a safe line. You come away able to review a docker run line or a compose file with a security eye.',
    teaches: [
      'Container security',
      'Docker socket exposure',
      'Privileged containers and Linux capabilities',
      'Host namespace sharing',
    ],
    level: 'Intermediate',
    tryThis: [
      'In "The CI runner", find the token that gives away the host and read why the Docker socket equals root.',
      'Work through "The one that looks careful" to see why --cap-add=SYS_ADMIN with AppArmor unconfined is still an escape.',
      'Finish all six scenarios and compare the fixes, such as rootless builders and socket proxies, with what you run today.',
    ],
    faq: [
      {
        question: 'Why is mounting /var/run/docker.sock dangerous?',
        answer:
          'The socket is the Docker daemon API, and the daemon runs as root. Anyone who can reach it can start a new container that mounts the host filesystem, which is full control of the host.',
      },
      {
        question: 'What does --privileged do?',
        answer:
          'It gives the container almost all Linux capabilities, access to host devices and fewer security restrictions, so a process inside can usually take over the host.',
      },
      {
        question: 'Is a container as isolated as a virtual machine?',
        answer:
          'No. Containers share the host kernel, so isolation depends on namespaces, capabilities, seccomp and other settings. One risky flag can remove most of it.',
      },
    ],
  },

  'promql-playground': {
    summary:
      'PromQL is the query language of Prometheus, and most of it comes down to selecting a time series, turning counters into rates and aggregating by labels. This playground teaches that in a guided sequence against sample HTTP request metrics. You start by selecting every series of a request counter, then filter it with label matchers to keep only GET requests, then narrow further to successful GET requests. Next you use rate() to turn an ever-growing counter into requests per second, sum() to add the series together, and sum by method to break the total down by HTTP method. The last step builds a real-world error rate: the rate of 5xx responses divided by the rate of all responses, expressed as a percentage, which is the query behind many alerts and SLOs. Each step shows the query and its result, so you can see what each function does to the data. The explanation below covers counters, gauges, histograms, label matching and the common functions you will meet in dashboards.',
    teaches: [
      'PromQL basics',
      'Label matchers',
      'rate() on counters',
      'Aggregation with sum by',
      'Error rate queries',
    ],
    level: 'Beginner',
    tryThis: [
      'Run the first query to see every request series, then add a label matcher to keep only GET requests.',
      'Use the requests per second step to see how rate() turns a counter into a per-second value.',
      'Build the error rate percentage query and compare it with the total requests per second.',
    ],
    faq: [
      {
        question: 'Why use rate() on a Prometheus counter?',
        answer:
          'A counter only goes up, so its raw value says little. rate() computes the per-second increase over a time window, handles counter resets and gives you a usable throughput number.',
      },
      {
        question: 'What is the difference between rate() and irate()?',
        answer:
          'rate() averages the increase across the whole range, which suits alerts and graphs. irate() uses only the last two samples, so it reacts faster but is noisier.',
      },
      {
        question: 'How do I calculate an error rate in PromQL?',
        answer:
          'Divide the rate of error responses by the rate of all responses, for example sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])), and multiply by 100 for a percentage.',
      },
    ],
  },

  'service-mesh-simulator': {
    summary:
      'A service mesh moves network concerns such as encryption, retries and traffic control out of application code and into proxies that run next to every service. This simulator explains that idea in six steps. It starts with the problem: services talking to each other directly, without encryption and without a consistent way to handle failures. Then it adds sidecar proxies, one next to each service, so all traffic between services passes through them. The following steps show what the proxies make possible without changing the applications: automatic mutual TLS, so every request between services is encrypted and both sides prove their identity; safer deployments, where a share of traffic can be routed to a new version before the rest; automatic retries for failed requests; and a circuit breaker that stops sending traffic to a failing service so it can recover. Each step is illustrated with the services and the paths between them. The notes below cover traffic management, the benefits and costs of a mesh, and popular options such as Istio and Linkerd.',
    teaches: [
      'Service mesh architecture',
      'Sidecar proxies',
      'Mutual TLS between services',
      'Retries and circuit breakers',
      'Traffic splitting for releases',
    ],
    level: 'Intermediate',
    tryThis: [
      'Start at "The Problem: Insecure Communication" and step forward to see where the sidecar proxies are added.',
      'Open the automatic encryption step and note which part of the path mutual TLS protects.',
      'Step through the retries and circuit breaker features and compare when each one acts.',
    ],
    faq: [
      {
        question: 'What is a service mesh?',
        answer:
          'An infrastructure layer of proxies, usually sidecars, that handles service-to-service traffic: encryption, authentication, retries, timeouts, traffic routing and telemetry, configured centrally instead of in each application.',
      },
      {
        question: 'What is mutual TLS?',
        answer:
          'TLS where both the client and the server present certificates, so each side proves its identity and the traffic is encrypted. Meshes issue and rotate these certificates automatically.',
      },
      {
        question: 'Do I need a service mesh?',
        answer:
          'Not for a handful of services. A mesh pays off when many services need consistent security, traffic control and observability; it adds operational cost and some latency.',
      },
    ],
  },

  'linux-terminal': {
    summary:
      'This Linux terminal simulator is a guided tutorial for the commands you use every day on a server, run safely in your browser. It has a small file system with a home directory, documents, projects, configuration files, a hidden file, /etc and /var/log, so commands behave the way they would on a real machine. Six lessons build up in order. Navigation basics covers pwd, ls and cd, including ls -a for hidden files. File operations covers touch, mkdir, cp, mv and rm. Viewing and searching covers head, tail, grep, wc and find, which handle text the way the real tools do, including how a last line without a newline is counted. Permissions and ownership covers reading ls -l output and changing modes with chmod. System information covers whoami, hostname, df, free, env and the PATH variable. Pipes and redirection covers sending one command output into another and writing or appending to files. Each step checks your command and explains what it did, so you learn the habits, not only the syntax.',
    teaches: [
      'Linux command line basics',
      'Navigating the file system',
      'Viewing and searching files with grep, head and tail',
      'File permissions with chmod',
      'Pipes and redirection',
    ],
    level: 'Beginner',
    tryThis: [
      'In "Navigation Basics", run ls -a in the home directory and find the hidden files.',
      'In "Viewing & Searching", read the end of /var/log/syslog with tail and search a file with grep.',
      'In "Pipes & Redirection", count files with ls | wc -l, then write and append to hello.txt with > and >>.',
    ],
    faq: [
      {
        question: 'How do I see hidden files in Linux?',
        answer:
          'Use ls -a, or ls -la for a long listing. Files and directories whose names start with a dot are hidden from a plain ls.',
      },
      {
        question: 'What is the difference between > and >> in the shell?',
        answer:
          '> redirects output to a file and replaces its contents. >> appends to the end of the file instead.',
      },
      {
        question: 'What does a pipe do?',
        answer:
          'The | operator sends the standard output of one command to the standard input of the next, for example grep error app.log | wc -l to count matching lines.',
      },
    ],
  },
};

export function getSimulatorExplainer(id: string): SimulatorExplainerContent | undefined {
  return explainers[id];
}

export function simulatorExplainerIds(): string[] {
  return Object.keys(explainers);
}
