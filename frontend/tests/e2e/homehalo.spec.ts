import { test, expect } from '@playwright/test'

test.describe('HomeHalo UI & Safety Coordinator E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Mock health, household, summary, events, plans, activity
    await page.route('/api/health', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok', database: 'ok' }),
      })
    })

    await page.route('/api/household', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'demo-household',
            name: 'The Rivera Household',
            mode: 'sleeping',
            timezone: 'America/Chicago',
            members: [
              { id: 'mem-001', name: 'Elena Rivera', role: 'adult' },
              { id: 'mem-004', name: 'Grandma Rosa', role: 'senior' },
            ],
            devices: [
              { id: 'dev-back-door', name: 'Back Door Sensor', type: 'door_sensor', location: 'Back Yard' },
            ],
            quiet_hours: { start: '22:00', end: '07:00' },
            checkin_schedules: [],
            is_demo: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }),
        })
      } else if (route.request().method() === 'PATCH') {
        const body = JSON.parse(route.request().postData() || '{}')
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'demo-household',
            name: 'The Rivera Household',
            mode: body.mode || 'home',
            timezone: 'America/Chicago',
            members: [],
            devices: [],
            is_demo: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }),
        })
      }
    })

    await page.route('/api/summary', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          total_events: 1,
          by_level: { low: 0, elevated: 0, high: 1, critical: 0 },
          open_plans: 1,
          recent_events: [
            {
              id: 'evt-test-123',
              household_id: 'demo-household',
              event_type: 'door_activity',
              source: 'simulated',
              occurred_at: new Date().toISOString(),
              recorded_at: new Date().toISOString(),
              payload: { device_id: 'dev-back-door', action: 'opened' },
              status: 'assessed',
              household_mode_at_event: 'sleeping',
              assessment: {
                level: 'high',
                rule_ids: ['RULE-DOOR-001'],
                known_facts: ['Quiet hours active', 'Mode is sleeping'],
                missing_evidence: ['No backyard motion detector'],
                inferred_risk: 'Exterior door breached during sleeping hours',
                explanation: 'Back door opened during quiet hours while mode is sleeping',
                engine_version: '1.0.0',
                assessed_at: new Date().toISOString(),
              },
            },
          ],
        }),
      })
    })

    await page.route('/api/plans*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'plan-test-1',
            household_id: 'demo-household',
            event_id: 'evt-test-123',
            assessment_level: 'high',
            summary: 'Night Door Activity Response Protocol',
            steps: [
              {
                step_id: 'step-1',
                order: 1,
                priority: 'urgent',
                title: 'Verify Resident Safety',
                detail: 'Confirm whether an authorized household member opened the door.',
                kind: 'advice',
                requires_confirmation: true,
                status: 'proposed',
              },
            ],
            source: 'rules',
            disclaimer: 'Simulated coordination protocol only.',
            status: 'open',
            created_at: new Date().toISOString(),
          },
        ]),
      })
    })

    await page.route('/api/events*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'evt-test-123',
            household_id: 'demo-household',
            event_type: 'door_activity',
            source: 'simulated',
            occurred_at: new Date().toISOString(),
            recorded_at: new Date().toISOString(),
            payload: { device_id: 'dev-back-door', action: 'opened' },
            status: 'assessed',
            household_mode_at_event: 'sleeping',
            assessment: {
              level: 'high',
              rule_ids: ['RULE-DOOR-001'],
              known_facts: ['Quiet hours active'],
              missing_evidence: ['No backyard camera'],
              inferred_risk: 'Exterior door breached',
              explanation: 'Back door opened during quiet hours',
              engine_version: '1.0.0',
              assessed_at: new Date().toISOString(),
            },
          },
        ]),
      })
    })

    await page.route('/api/activity*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })
  })

  test('loads dashboard and displays safety notice banner', async ({ page }) => {
    await page.goto('/')

    // Safety notice banner check
    await expect(page.locator('aside[aria-label="Safety Notice"]')).toContainText(
      'Simulated Events Only'
    )

    // Household name check
    await expect(page.locator('h1')).toContainText('The Rivera Household')

    // High risk count check
    await expect(page.locator('text=High Risk').first()).toBeVisible()

    // Active response plan check
    await expect(page.locator('text=Night Door Activity Response Protocol')).toBeVisible()
  })

  test('opens simulation modal on button click', async ({ page }) => {
    await page.goto('/')
    await page.click('button:has-text("Simulate Event")')

    // Modal should be visible
    await expect(page.locator('h3:has-text("Simulate Safety Event")')).toBeVisible()
    await expect(page.locator('text=Curated Scenarios (1-Click)')).toBeVisible()
    await expect(page.locator('text=Night Door Opening')).toBeVisible()
  })

  test('navigates to assistant and asks a question', async ({ page }) => {
    await page.route('/api/assistant/chat', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          answer: 'The Rivera household is currently in sleeping mode with 1 active high-risk plan.',
          sources: [{ collection: 'households', id: 'demo-household' }],
          unknowns: ['No backyard video feed available'],
          used_llm: false,
        }),
      })
    })

    await page.goto('/assistant')
    await expect(page.locator('h1')).toContainText('AI Safety Coordination Assistant')

    const input = page.locator('input[placeholder*="Ask about incidents"]')
    await input.fill('What is the household status?')
    await page.click('button[title="Send Message"]')

    await expect(
      page.locator('text=The Rivera household is currently in sleeping mode')
    ).toBeVisible()
    await expect(page.locator('text=households:demo-house')).toBeVisible()
  })
})
