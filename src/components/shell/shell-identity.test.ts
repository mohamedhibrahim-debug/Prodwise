import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initials,splitActorLabel} from './ShellIdentity.ts';

test('a Platform Owner acting outside their memberships keeps their name and initials; the note is separate (m9)',()=>{
  const label='Mohamed Hassan (Platform Owner, not a member)';
  assert.deepEqual(splitActorLabel(label),{name:'Mohamed Hassan',note:'Platform Owner · not a member here'});
  assert.equal(initials(splitActorLabel(label).name),'MH');
  assert.equal(initials(label),'MM');
});
test('ordinary members are unchanged',()=>{
  assert.deepEqual(splitActorLabel('Local Owner'),{name:'Local Owner',note:null});
  assert.deepEqual(splitActorLabel('Ann (Platform Owner)'),{name:'Ann (Platform Owner)',note:null});
});
