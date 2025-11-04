import { useEffect, useState } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  Position,
} from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';
import { supabase } from '@/integrations/supabase/client';

interface PrerequisiteGraphProps {
  curriculumVersionId: string;
  userCourses: any[];
}

export function PrerequisiteGraph({ curriculumVersionId, userCourses }: PrerequisiteGraphProps) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGraph();
  }, [curriculumVersionId, userCourses]);

  const loadGraph = async () => {
    try {
      // Get all courses in curriculum
      const { data: groups } = await (supabase as any)
        .from('requirement_groups')
        .select('id')
        .eq('curriculum_id', curriculumVersionId);

      const groupIds = groups?.map((g: any) => g.id) || [];
      const { data: rules } = await (supabase as any)
        .from('requirement_rules')
        .select('course_ids')
        .in('req_group_id', groupIds);

      const allCourseIds = [...new Set(rules?.flatMap((r: any) => r.course_ids || []) || [])];

      const { data: courses } = await (supabase as any)
        .from('courses')
        .select('id, course_code, course_title, units, prereq_expr')
        .in('id', allCourseIds);

      if (!courses) return;

      // Determine completed courses
      const completedCodes = new Set(
        userCourses
          .filter(c => c.grade && c.grade !== 'F' && c.grade !== 'W')
          .map(c => c.course_code)
      );

      // Build nodes
      const courseMap = new Map(courses.map((c: any) => [c.course_code, c]));
      const graphNodes: Node[] = [];
      const graphEdges: Edge[] = [];

      courses.forEach((course: any) => {
        const isCompleted = completedCodes.has(course.course_code);
        
        // Determine if prerequisites are met
        const prereqs = extractPrerequisites(course.prereq_expr || '');
        const prereqsMet = prereqs.every(p => completedCodes.has(p));
        const isReady = !isCompleted && (prereqs.length === 0 || prereqsMet);

        let nodeColor = '#94a3b8'; // gray - not accessible
        if (isCompleted) nodeColor = '#22c55e'; // green - completed
        else if (isReady) nodeColor = '#fbbf24'; // yellow - ready

        graphNodes.push({
          id: course.course_code,
          data: { 
            label: (
              <div className="text-center">
                <div className="font-semibold text-sm">{course.course_code}</div>
                <div className="text-xs">{course.units}u</div>
              </div>
            )
          },
          position: { x: 0, y: 0 }, // Will be set by dagre
          style: {
            background: nodeColor,
            color: '#fff',
            border: '2px solid #fff',
            borderRadius: '8px',
            padding: '10px',
            fontSize: '12px',
            width: 120,
          },
          sourcePosition: Position.Right,
          targetPosition: Position.Left,
        });

        // Add edges for prerequisites
        prereqs.forEach(prereq => {
          if (courseMap.has(prereq)) {
            graphEdges.push({
              id: `${prereq}-${course.course_code}`,
              source: prereq,
              target: course.course_code,
              animated: !completedCodes.has(prereq),
              style: { stroke: '#64748b' },
            });
          }
        });
      });

      // Apply dagre layout
      const dagreGraph = new dagre.graphlib.Graph();
      dagreGraph.setDefaultEdgeLabel(() => ({}));
      dagreGraph.setGraph({ rankdir: 'LR', ranksep: 150, nodesep: 80 });

      graphNodes.forEach(node => {
        dagreGraph.setNode(node.id, { width: 120, height: 60 });
      });

      graphEdges.forEach(edge => {
        dagreGraph.setEdge(edge.source, edge.target);
      });

      dagre.layout(dagreGraph);

      // Update node positions
      const layoutedNodes = graphNodes.map(node => {
        const nodeWithPosition = dagreGraph.node(node.id);
        return {
          ...node,
          position: {
            x: nodeWithPosition.x - 60,
            y: nodeWithPosition.y - 30,
          },
        };
      });

      setNodes(layoutedNodes);
      setEdges(graphEdges);
    } catch (error) {
      console.error('Error loading graph:', error);
    } finally {
      setLoading(false);
    }
  };

  const extractPrerequisites = (prereqExpr: string): string[] => {
    if (!prereqExpr) return [];
    
    // Extract course codes (format: DEPT-### or DEPT###)
    const matches = prereqExpr.match(/[A-Z]{2,5}-?\d{2,4}/gi) || [];
    return matches.map(m => m.replace(/\s/g, '').toUpperCase());
  };

  if (loading) {
    return <div className="text-center py-8">Loading prerequisite graph...</div>;
  }

  return (
    <div className="h-[600px] w-full border rounded-lg">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        minZoom={0.1}
        maxZoom={2}
      >
        <Background />
        <Controls />
        <MiniMap 
          nodeColor={(node) => {
            return node.style?.background as string || '#94a3b8';
          }}
        />
      </ReactFlow>
      <div className="mt-4 flex gap-4 justify-center text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ background: '#22c55e' }} />
          <span>Completed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ background: '#fbbf24' }} />
          <span>Ready to Take</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ background: '#94a3b8' }} />
          <span>Prerequisites Missing</span>
        </div>
      </div>
    </div>
  );
}
