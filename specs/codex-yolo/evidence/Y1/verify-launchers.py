#!/usr/bin/env python3
"""Capture launcher argv with temporary stubs; never access live Herdr state."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile


LAUNCHERS = Path(__file__).resolve().parent / 'after'
STUB = '''#!{python}
import json, os, sys
from pathlib import Path
name = Path(sys.argv[0]).name
with open(os.environ['CAPTURE'], 'a') as out:
    out.write(json.dumps({{'command': name, 'args': sys.argv[1:],
                          'cwd': os.getcwd(), 'szef': os.environ.get('MOWA_SZEF')}}) + '\\n')
if name == 'herdr':
    if sys.argv[1:3] == ['agent', 'get']:
        sys.exit(0 if os.environ.get('EXISTING_AGENT') == '1' else 1)
    if sys.argv[1:3] == ['workspace', 'create']:
        print(json.dumps({{'result': {{'root_pane': {{'pane_id': 'stub-pane'}}}}}}))
'''


def main():
    checks = 0
    with tempfile.TemporaryDirectory(prefix='mowa-Y1-') as temporary:
        base = Path(temporary)
        root = base / 'root with spaces'
        agents = base / 'agents with spaces'
        workspace = agents / 'worker-1'
        workspace.mkdir(parents=True)
        root.mkdir()
        bin_dir = base / 'bin'
        bin_dir.mkdir()
        for name in ('codex', 'herdr', 'rsync'):
            path = bin_dir / name
            path.write_text(STUB.format(python=sys.executable))
            path.chmod(0o755)
        # Only system tools the launchers need, avoiding any real codex/herdr.
        for name, target in (('cat', '/bin/cat'), ('env', '/usr/bin/env'), ('mkdir', '/bin/mkdir'),
                             ('python3', sys.executable)):
            (bin_dir / name).symlink_to(target)
        capture = base / 'capture.jsonl'
        marker = base / 'must-not-exist'
        hostile = '"quoted" \'apostrophe\' $(touch ' + str(marker) + ') `touch ' + str(marker) + '`; $HOME \\ newline\nPolish: żółć'
        ticket = root / ('ticket ' + hostile.replace('/', '_') + '.md')
        ticket.write_text('fixture ticket, no secrets\n')
        env = {key: value for key, value in os.environ.items()
               if not key.startswith('MOWA_') and key not in ('HERDR_ENV', 'EXISTING_AGENT')}
        env.update(PATH=str(bin_dir), HERDR_ENV='1', MOWA_ROOT=str(root),
                   MOWA_AGENTS=str(agents), CAPTURE=str(capture))

        def run(script, args, updates=None):
            capture.write_text('')
            current = env.copy()
            current.update(updates or {})
            result = subprocess.run(['/bin/bash', str(LAUNCHERS / script), *args],
                                    env=current, text=True, capture_output=True)
            calls = [json.loads(line) for line in capture.read_text().splitlines()]
            assert not marker.exists(), 'user content was executed'
            return result, calls

        def passed(label):
            nonlocal checks
            checks += 1
            print('PASS: ' + label)

        def settings(args, model, effort):
            assert args.count('--yolo') == 1, args
            for conflict in ('--sandbox', '--ask-for-approval', '-s', '-a',
                             '--full-auto', '--dangerously-bypass-approvals-and-sandbox'):
                assert conflict not in args, args
            assert args[args.index('--model') + 1] == model, args
            assert args[args.index('-c') + 1] == 'model_reasoning_effort="' + effort + '"', args

        overrides = [({}, None, None, 'defaults'),
                     ({'MOWA_MODEL': 'override-model'}, 'override-model', None, 'model override'),
                     ({'MOWA_EFFORT': 'low'}, None, 'low', 'effort override'),
                     ({'MOWA_MODEL': 'override-model', 'MOWA_EFFORT': 'low'},
                      'override-model', 'low', 'both overrides')]
        goal_args = [hostile, 'second argument']
        goal = ' '.join(goal_args)
        expected_szef = ('Start as Szef for mowa.\n\nGoal from Szymon:\n' + goal +
                         '\n\nRead SZEF.md, vision.md, build.md, AGENT-LOOP.md, and AGENTS.md. Then create or\n'
                         'update specs/<slug>/, write worker-sized tickets, update build.md, and dispatch\n'
                         'workers only when the ticket is ready. Report to Szymon in Polish. Do not\n'
                         'implement product code in this session.')
        for updates, model, effort, label in overrides:
            result, calls = run('mowa-szef', goal_args, updates)
            assert result.returncode == 0, result.stderr
            assert len(calls) == 1 and calls[0]['command'] == 'codex', calls
            call = calls[0]
            settings(call['args'], model or 'gpt-6-astra', effort or 'high')
            assert call['args'][-1] == expected_szef
            assert call['cwd'] == str(root) and call['szef'] == '1'
            passed('coordinator ' + label + '; exact multiline goal/prompt, cwd and MOWA_SZEF')

        roles = {'spec-writer': ('gpt-6-astra', 'high'),
                 'implementer': ('gpt-5.6-sol', 'high'),
                 'reviewer': ('gpt-5.6-sol', 'high'),
                 'diagnoser': ('gpt-6-astra', 'high'),
                 'investigator': ('gpt-5.6-terra', 'medium')}
        for role, (default_model, default_effort) in roles.items():
            for updates, model, effort, label in overrides:
                current = dict(updates, MOWA_WHY=hostile)
                # Exercise both implicit and explicit Codex kind.
                args = ['worker-1', role, str(ticket)]
                if label != 'defaults':
                    args.append('codex')
                result, calls = run('mowa-dispatch-herdr', args, current)
                assert result.returncode == 0, result.stderr
                assert all(call['command'] != 'codex' for call in calls), calls
                herdr = [call['args'] for call in calls if call['command'] == 'herdr']
                assert [call[:2] for call in herdr] == [
                    ['agent', 'get'], ['workspace', 'create'], ['agent', 'start'], ['agent', 'prompt']], herdr
                assert herdr[1] == ['workspace', 'create', '--cwd', str(workspace),
                                    '--label', 'worker-1', '--env', 'MOWA_ROLE=' + role, '--no-focus']
                start = herdr[2]
                assert start[:10] == ['agent', 'start', 'worker-1', '--kind', 'codex',
                                      '--pane', 'stub-pane', '--timeout', '90000', '--'], start
                settings(start[10:], model or default_model, effort or default_effort)
                assert start[-2:] == ['--add-dir', str(root)]
                expected = ('You are the ' + role + ' for this task. Read the ticket first, then ' +
                            str(root) + '/roles/_common.md and ' + str(root) + '/roles/' + role + '.md.\n'
                            'Ticket: ' + str(ticket) + '\nWhy it matters: ' + hostile)
                assert herdr[3] == ['agent', 'prompt', 'worker-1', expected, '--wait', '--timeout', '120000']
                assert (workspace / 'roles').is_dir() and (workspace / 'specs').is_dir()
                passed('worker ' + role + ' ' + label + '; exact ticket/why/prompt and Herdr arguments')

        result, calls = run('mowa-dispatch-herdr', ['worker-1', 'implementer', str(ticket)])
        assert result.returncode == 0
        prompt = next(call['args'][3] for call in calls
                      if call['command'] == 'herdr' and call['args'][:2] == ['agent', 'prompt'])
        assert prompt.endswith('Why it matters: this ticket is part of the mowa overnight worker loop; '
                               'read the ticket, do exactly that work, append notes, then stop.')
        passed('worker default Why it matters text')

        valid = ['worker-1', 'implementer', str(ticket)]
        invalid = [
            ('mowa-szef', [], {}, 2, 'usage:', 'coordinator missing goal'),
            ('mowa-szef', [''], {}, 2, 'usage:', 'coordinator empty goal'),
            ('mowa-szef', ['goal'], {'HERDR_ENV': '0'}, 1, 'inside Herdr', 'coordinator Herdr guard'),
            ('mowa-dispatch-herdr', [], {}, 2, 'usage:', 'worker missing arguments'),
            ('mowa-dispatch-herdr', valid + ['codex', 'extra'], {}, 2, 'usage:', 'worker extra arguments'),
            ('mowa-dispatch-herdr', valid, {'HERDR_ENV': '0'}, 1, 'Herdr pane', 'worker Herdr guard'),
            ('mowa-dispatch-herdr', ['../bad', *valid[1:]], {}, 2, 'agent name', 'worker traversal name'),
            ('mowa-dispatch-herdr', ['Bad', *valid[1:]], {}, 2, 'agent name', 'worker uppercase name'),
            ('mowa-dispatch-herdr', ['a' * 33, *valid[1:]], {}, 2, 'agent name', 'worker long name'),
            ('mowa-dispatch-herdr', ['worker-1', 'unknown', str(ticket)], {}, 2, 'usage:', 'worker invalid role'),
            ('mowa-dispatch-herdr', valid + ['claude'], {}, 2, 'Claude dispatch is disabled', 'worker Claude guard'),
            ('mowa-dispatch-herdr', valid + ['unknown'], {}, 2, 'usage:', 'worker invalid kind'),
            ('mowa-dispatch-herdr', ['worker-1', 'implementer', str(root / 'missing')], {}, 1,
             'ticket not found:', 'worker missing ticket'),
            ('mowa-dispatch-herdr', valid, {'EXISTING_AGENT': '1'}, 1,
             'agent already exists:', 'worker existing-agent guard'),
        ]
        for script, args, updates, code, message, label in invalid:
            result, calls = run(script, args, updates)
            assert result.returncode == code and message in result.stderr, (label, result)
            herdr = [call['args'] for call in calls if call['command'] == 'herdr']
            assert herdr == ([['agent', 'get', 'worker-1']] if updates.get('EXISTING_AGENT') else []), calls
            assert all(call['command'] != 'codex' for call in calls), calls
            passed(label + '; exit ' + str(code) + ', no launch/prompt')

        (bin_dir / 'codex').unlink()
        for script, args in [('mowa-szef', ['goal']), ('mowa-dispatch-herdr', valid)]:
            result, calls = run(script, args)
            assert result.returncode == 1 and 'codex not found on PATH' in result.stderr
            assert calls == []
            passed(script + ' missing Codex guard; exit 1, no external calls')
    print(str(checks) + ' checks passed; all fixtures removed; no live Codex or Herdr calls.')


if __name__ == '__main__':
    main()
