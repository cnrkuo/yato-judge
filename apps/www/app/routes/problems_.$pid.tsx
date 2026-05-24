import { useLoaderData } from 'react-router';

export const meta = () => [{ title: 'Problem – YATO Judge' }];

// TODO: replace fake data with API calling
// TODO: add types
export const loader = async () => ({
  id: 1,
  title: 'Weird Algorithm',
  difficulty: 'E',
  timeLimit: '1s',
  memoryLimit: '512MB',
  userAcceptance: 78,
  submissionAcceptance: 42,
  samples: [
    {
      input: `4
2 7 11 15
9`,
      output: `0 1`,
    },
  ],
});

export default function Problem() {
  const { id, title, difficulty, timeLimit, memoryLimit, userAcceptance, submissionAcceptance } = useLoaderData();

  return (
    <div className="space-y-10">
      <section className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm text-zinc-500">#{id}</span>
          <h1 className="text-2xl font-semibold text-zinc-100">{title}</h1>
          <span className="font-mono text-sm text-emerald-400">[{difficulty}]</span>
        </div>

        <div className="flex flex-wrap gap-6 text-sm text-zinc-400">
          <span>
            Time Limit <span className="font-mono text-zinc-300">{timeLimit}</span>
          </span>
          <span>
            Memory Limit <span className="font-mono text-zinc-300">{memoryLimit}</span>
          </span>
          <span>
            User AC <span className="font-mono text-zinc-300">{userAcceptance}%</span>
          </span>
          <span>
            Sub AC <span className="font-mono text-zinc-500">{submissionAcceptance}%</span>
          </span>
        </div>
      </section>

      <section className="space-y-6 text-zinc-200">
        <p>
          Consider an algorithm that takes as input a positive integer{' '}
          <math>
            <mi>n</mi>
          </math>
          . If{' '}
          <math>
            <mi>n</mi>
          </math>{' '}
          is even, the algorithm divides it by two, and if{' '}
          <math>
            <mi>n</mi>
          </math>{' '}
          is odd, the algorithm multiplies it by three and adds one. The algorithm repeats this process until{' '}
          <math>
            <mi>n</mi>
          </math>{' '}
          is one.
        </p>
        <p>
          For example, the sequence for{' '}
          <math>
            <mi>n</mi>
            <mo>=</mo>
            <mn>3</mn>
          </math>{' '}
          is:
        </p>
        <p>
          <math xmlns="http://www.w3.org/1998/Math/MathML">
            <mn>3</mn>
            <mo>→</mo>
            <mn>10</mn>
            <mo>→</mo>
            <mn>5</mn>
            <mo>→</mo>
            <mn>16</mn>
            <mo>→</mo>
            <mn>8</mn>
            <mo>→</mo>
            <mn>4</mn>
            <mo>→</mo>
            <mn>2</mn>
            <mo>→</mo>
            <mn>1</mn>
          </math>
        </p>

        <p>
          Your task is to simulate the execution of the algorithm for a given value of{' '}
          <math>
            <mi>n</mi>
          </math>
          .
        </p>

        <div className="space-y-2">
          <h2 className="font-semibold text-zinc-100">Input</h2>
          <p>
            The only input line contains an integer{' '}
            <math>
              <mi>n</mi>
            </math>
            .
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="font-semibold text-zinc-100">Output</h2>
          <p>
            Print a line that contains all values of{' '}
            <math>
              <mi>n</mi>
            </math>{' '}
            during the algorithm.
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="font-semibold text-zinc-100">Constraints</h2>
          <math>
            <mn>1</mn>
            <mo>≤</mo>
            <mi>n</mi>
            <mo>≤</mo>
            <msup>
              <mn>10</mn>
              <mn>6</mn>
            </msup>
          </math>
        </div>

        <div className="space-y-3">
          <h2 className="font-semibold text-zinc-100">Example</h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
              <div className="mb-2 text-xs uppercase text-zinc-400">Input</div>
              <pre className="font-mono text-sm text-zinc-200">3</pre>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
              <div className="mb-2 text-xs uppercase text-zinc-400">Output</div>
              <pre className="font-mono text-sm text-zinc-200">3 10 5 16 8 4 2 1</pre>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-6 rounded-lg border border-zinc-800 bg-zinc-900/40 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-100">Submit Solution</h2>
        </div>

        <div className="space-y-2">
          <label className="block text-sm text-zinc-400">Language</label>
          <select
            className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-600"
            defaultValue="cpp20">
            <option value="cpp20">C++ (GNU++23)</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-sm text-zinc-400">Source File</label>

          <div className="flex items-center gap-3">
            <label className="inline-flex cursor-pointer items-center rounded-md border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900">
              Choose file
              <input type="file" className="hidden" accept=".cpp,.cc,.cxx,.py" />
            </label>

            <span className="text-sm text-zinc-500">No file selected</span>
          </div>

          <p className="text-xs text-zinc-500">Accepted formats: .cpp, .py · Max size 256 KB</p>
        </div>

        <div className="flex gap-3">
          <button className="rounded-md bg-zinc-100 px-6 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-200">
            Submit
          </button>
        </div>
      </section>
    </div>
  );
}
