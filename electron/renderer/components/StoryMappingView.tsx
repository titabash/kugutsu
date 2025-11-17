/**
 * Story Mapping View Component
 *
 * Displays story mapping information including persona, epics, and user stories
 */

import React from 'react';
import { useAppStore } from '../store/appStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';

const StoryMappingView: React.FC = () => {
  const storyMapping = useAppStore((state) => state.storyMapping);

  if (!storyMapping) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>No Story Mapping Available</CardTitle>
            <CardDescription>
              Story mapping has not been created yet. Run the Scrum development workflow to generate it.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const { persona, epics } = storyMapping;

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      {/* Persona Section */}
      <Card>
        <CardHeader>
          <CardTitle>Persona</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div data-testid="persona">
            <div className="space-y-2">
              <div>
                <span className="font-semibold">Name: </span>
                <span data-testid="persona-name">{persona.name}</span>
              </div>
              <div>
                <span className="font-semibold">Role: </span>
                <span data-testid="persona-role">{persona.role}</span>
              </div>
              <div>
                <span className="font-semibold">Goal: </span>
                <span data-testid="persona-goal">{persona.goal}</span>
              </div>
            </div>

            {persona.painPoints && persona.painPoints.length > 0 && (
              <div className="mt-4">
                <div className="font-semibold mb-2">Pain Points:</div>
                <div data-testid="pain-points" className="space-y-1">
                  {persona.painPoints.map((point, index) => (
                    <div
                      key={index}
                      data-testid={`pain-point-${index}`}
                      className="flex items-start"
                    >
                      <span className="mr-2">•</span>
                      <span>{point}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Epics Section */}
      {epics && epics.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Epics</h2>
          {epics.map((epic) => (
            <Card key={epic.id} data-testid={`epic-${epic.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle data-testid={`epic-title-${epic.id}`}>
                      {epic.title}
                    </CardTitle>
                    {epic.description && (
                      <CardDescription
                        data-testid={`epic-description-${epic.id}`}
                        className="mt-2"
                      >
                        {epic.description}
                      </CardDescription>
                    )}
                  </div>
                  <Badge variant="outline" data-testid={`epic-priority-${epic.id}`}>
                    Priority: {epic.priority}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {/* User Stories */}
                {epic.stories && epic.stories.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm text-muted-foreground">
                      User Stories
                    </h4>
                    <div className="space-y-3">
                      {epic.stories.map((story) => (
                        <Card
                          key={story.id}
                          data-testid={`story-${story.id}`}
                          className="border-l-4 border-l-primary"
                        >
                          <CardHeader className="pb-3">
                            <CardTitle
                              data-testid={`story-title-${story.id}`}
                              className="text-base"
                            >
                              {story.title}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {/* User Story Format */}
                            <div className="space-y-2 text-sm">
                              <div>
                                <span className="font-semibold">As a </span>
                                <span data-testid="story-as-a">{story.asA}</span>
                              </div>
                              <div>
                                <span className="font-semibold">I want to </span>
                                <span data-testid="story-i-want-to">{story.iWantTo}</span>
                              </div>
                              <div>
                                <span className="font-semibold">So that </span>
                                <span data-testid="story-so-that">{story.soThat}</span>
                              </div>
                            </div>

                            {/* Acceptance Criteria */}
                            {story.acceptanceCriteria && story.acceptanceCriteria.length > 0 && (
                              <div>
                                <div className="font-semibold text-sm mb-2">
                                  Acceptance Criteria:
                                </div>
                                <ul className="space-y-1">
                                  {story.acceptanceCriteria.map((criteria, index) => (
                                    <li
                                      key={index}
                                      data-testid={`acceptance-criteria-${index}`}
                                      className="text-sm flex items-start"
                                    >
                                      <span className="mr-2">✓</span>
                                      <span>{criteria}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Priority and Estimated Points */}
                            <div className="flex gap-2 pt-2">
                              <Badge variant="secondary" data-testid="story-priority">
                                Priority: {story.priority}
                              </Badge>
                              <Badge variant="secondary" data-testid="story-estimated-points">
                                Points: {story.estimatedPoints}
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default StoryMappingView;
