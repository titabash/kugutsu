import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { User, Target, AlertCircle, CheckCircle2 } from 'lucide-react'
import type { StoryMapping } from '../types'

interface StoryMappingViewerProps {
  storyMapping: StoryMapping
}

export function StoryMappingViewer({ storyMapping }: StoryMappingViewerProps) {
  return (
    <div className="h-full overflow-auto">
      <div className="space-y-6 p-6">
        {/* Persona Section */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <CardTitle>ペルソナ</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <div className="text-sm font-medium text-muted-foreground">名前</div>
              <div className="text-lg font-semibold">{storyMapping.persona.name}</div>
            </div>

            <div className="space-y-1">
              <div className="text-sm font-medium text-muted-foreground">役割</div>
              <div className="text-base">{storyMapping.persona.role}</div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                <div className="text-sm font-medium text-muted-foreground">ゴール</div>
              </div>
              <div className="text-base">{storyMapping.persona.goal}</div>
            </div>

            {storyMapping.persona.painPoints && storyMapping.persona.painPoints.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <div className="text-sm font-medium text-muted-foreground">ペインポイント</div>
                </div>
                <ul className="mt-2 space-y-1 text-sm">
                  {storyMapping.persona.painPoints.map((pain, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="mt-0.5 text-amber-600">•</span>
                      <span>{pain}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Epics Section */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">エピック</h2>

          <Accordion type="single" collapsible className="space-y-2">
            {storyMapping.epics.map((epic) => (
              <AccordionItem
                key={epic.id}
                value={epic.id}
                className="rounded-lg border bg-card px-4"
              >
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex w-full items-center justify-between pr-4 text-left">
                    <div className="flex-1">
                      <div className="font-semibold">{epic.title}</div>
                      {epic.description && (
                        <div className="mt-1 text-sm text-muted-foreground">{epic.description}</div>
                      )}
                    </div>
                    <div className="flex flex-shrink-0 gap-2">
                      <Badge variant="secondary">{epic.stories.length} stories</Badge>
                      <Badge variant="outline">P{epic.priority}</Badge>
                    </div>
                  </div>
                </AccordionTrigger>

                <AccordionContent>
                  <div className="space-y-3 pt-4">
                    {epic.stories.map((story) => (
                      <Card key={story.id} className="border-l-4 border-l-primary">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <CardTitle className="text-base">{story.title}</CardTitle>
                            <div className="flex flex-shrink-0 gap-1">
                              <Badge variant="outline">P{story.priority}</Badge>
                              <Badge variant="secondary">{story.estimatedPoints}pt</Badge>
                            </div>
                          </div>
                        </CardHeader>

                        <CardContent className="space-y-3 text-sm">
                          {/* User Story Format */}
                          <div className="space-y-1 rounded-md bg-muted/50 p-3">
                            <div>
                              <span className="font-semibold text-blue-600 dark:text-blue-400">
                                As a
                              </span>{' '}
                              {story.asA}
                            </div>
                            <div>
                              <span className="font-semibold text-green-600 dark:text-green-400">
                                I want to
                              </span>{' '}
                              {story.iWantTo}
                            </div>
                            <div>
                              <span className="font-semibold text-purple-600 dark:text-purple-400">
                                So that
                              </span>{' '}
                              {story.soThat}
                            </div>
                          </div>

                          {/* Acceptance Criteria */}
                          <div>
                            <div className="mb-2 flex items-center gap-2 font-semibold">
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                              受入基準
                            </div>
                            <ul className="space-y-1">
                              {story.acceptanceCriteria.map((criteria, index) => (
                                <li key={index} className="flex items-start gap-2">
                                  <span className="mt-0.5 text-green-600">✓</span>
                                  <span>{criteria}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </div>
  )
}
