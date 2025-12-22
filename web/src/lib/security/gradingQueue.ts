type QueueTask = {
    run: () => Promise<unknown>;
    resolve: (value: unknown) => void;
    reject: (reason?: unknown) => void;
};

const DEFAULT_MAX_CONCURRENCY = 2;
const DEFAULT_MAX_QUEUE_LENGTH = 3;

const parsedConcurrency = Number(process.env.GRADING_QUEUE_CONCURRENCY);
const parsedQueueLength = Number(process.env.GRADING_QUEUE_MAX_LENGTH);
const MAX_CONCURRENCY = Number.isFinite(parsedConcurrency) && parsedConcurrency > 0
    ? parsedConcurrency
    : DEFAULT_MAX_CONCURRENCY;
const MAX_QUEUE_LENGTH = Number.isFinite(parsedQueueLength) && parsedQueueLength > 0
    ? parsedQueueLength
    : DEFAULT_MAX_QUEUE_LENGTH;

const queue: QueueTask[] = [];
let activeCount = 0;

export class QueueFullError extends Error {
    constructor(message = 'Queue is full') {
        super(message);
        this.name = 'QueueFullError';
    }
}

function runNext(): void {
    if (activeCount >= MAX_CONCURRENCY) return;
    const task = queue.shift();
    if (!task) return;
    activeCount += 1;
    task.run()
        .then(task.resolve)
        .catch(task.reject)
        .finally(() => {
            activeCount -= 1;
            runNext();
        });
}

export function enqueueGradingJob<T>(run: () => Promise<T>): { promise: Promise<T>; position: number } {
    if (queue.length >= MAX_QUEUE_LENGTH) {
        throw new QueueFullError('Queue length limit reached');
    }

    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });

    const task: QueueTask = {
        run: () => run(),
        resolve: (value) => resolve(value as T),
        reject,
    };
    queue.push(task);
    const position = queue.length;
    runNext();
    return { promise, position };
}

export function getQueueState() {
    return {
        activeCount,
        queuedCount: queue.length,
        maxConcurrency: MAX_CONCURRENCY,
        maxQueueLength: MAX_QUEUE_LENGTH,
    };
}
