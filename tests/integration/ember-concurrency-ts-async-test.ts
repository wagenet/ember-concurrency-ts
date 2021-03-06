import 'qunit-dom';
import 'ember-concurrency-ts/async';
import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { action, computed, set } from '@ember/object';
import { click, render, settled } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';
import { Task, TaskInstance } from 'ember-concurrency';
import { task } from 'ember-concurrency-decorators';
import { taskFor, perform } from 'ember-concurrency-ts';
import { expectTypeOf } from 'expect-type';
import Component from '@glimmer/component';
import { defer } from 'dummy/tests/utils';

module('Integration | ember-concurrency-ts', function(hooks) {
  setupRenderingTest(hooks);

  test('it works', async function(assert) {
    let { promise, resolve } = defer<string>();

    class MyComponent extends Component {
      resolved: string | null = null;
      lastValue: string | null = null;

      @task async myTask(arg: string): Promise<string> {
        set(this, 'resolved', await promise);
        return arg;
      }

      _() {
        expectTypeOf(this.myTask).toMatchTypeOf<Function>();
        expectTypeOf(taskFor(this.myTask)).toEqualTypeOf<Task<string, [string]>>();
      }

      @computed('myTask.performCount')
      get isWaiting(): boolean {
        expectTypeOf(taskFor(this.myTask).performCount).toEqualTypeOf<number>();
        return taskFor(this.myTask).performCount === 0;
      }

      @computed('myTask.isRunning')
      get isRunning(): boolean {
        expectTypeOf(taskFor(this.myTask).isRunning).toEqualTypeOf<boolean>();
        return taskFor(this.myTask).isRunning;
      }

      @computed('myTask.last.value')
      get value(): string | null | undefined {
        expectTypeOf(taskFor(this.myTask).last).toEqualTypeOf<TaskInstance<string> | null>();
        expectTypeOf(taskFor(this.myTask).last!.value).toEqualTypeOf<string | null>();
        return taskFor(this.myTask).last?.value;
      }

      @action performMyTask(arg: string) {
        perform(this.myTask, arg).then(value => {
          expectTypeOf(value).toEqualTypeOf<string>();
          set(this, 'lastValue', value);
        });
      }
    }

    this.owner.register('component:test', MyComponent);

    this.owner.register('template:components/test', hbs`
      {{#if this.isWaiting}}
        <button id="start" {{on "click" (fn this.performMyTask "Done!")}}>Start!</button>
      {{else if this.isRunning}}
        Running!
      {{else}}
        Finished!
        <span id="state">{{this.myTask.state}}</span>
        <span id="value">{{this.value}}</span>
        <span id="resolved">{{this.resolved}}</span>
      {{/if}}
    `);

    await render(hbs`<Test />`);

    assert.dom('button#start').hasText('Start!');
    assert.dom().doesNotContainText('Running!');
    assert.dom().doesNotContainText('Finished!');

    await click('button#start');

    assert.dom('button#start').doesNotExist();
    assert.dom().containsText('Running!');
    assert.dom().doesNotContainText('Finished!');

    resolve('Wow!');

    await settled();

    assert.dom('button#start').doesNotExist();
    assert.dom().doesNotContainText('Running!');
    assert.dom().containsText('Finished!');
    assert.dom('#state').hasText('idle');
    assert.dom('#value').hasText('Done!');
    assert.dom('#resolved').hasText('Wow!');
  });
});
