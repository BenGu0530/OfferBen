import { LibrarySchema, type Library } from "../../src/schema/library";

/** Fictional candidate shaped like a real robotics resume (lab -> projects -> paper/demos). */
export function sampleLibrary(): Library {
  return LibrarySchema.parse({
    basics: {
      name: "Alex Doe",
      contacts: [
        { text: "Pittsburgh, PA" },
        { text: "alex@example.edu" },
        { text: "alexdoe.dev", url: "https://alexdoe.dev" },
      ],
    },
    entries: [
      {
        id: "edu-ms",
        kind: "education",
        title: "M.S. in Robotics",
        org: "Example University",
        subtitle: "Robotics Institute",
        location: "Pittsburgh, PA",
        gpa: "4.0/4.0",
        start: "Aug 2025",
        end: "May 2027",
      },
      {
        id: "edu-bs",
        kind: "education",
        title: "B.S. in Mechanical Engineering",
        org: "Example University",
        location: "Pittsburgh, PA",
        gpa: "3.9/4.0",
        start: "Aug 2021",
        end: "May 2025",
      },
      {
        id: "pos-intern",
        kind: "position",
        section: "experience",
        title: "Robotics Engineer Intern",
        org: "Acme Robots",
        location: "Boston, MA",
        start: "May 2026",
        end: "Aug 2026",
        facts: [
          {
            id: "f-i1",
            text: "Trained a PPO posture policy that replaced a QP/IK controller on hardware.",
          },
          {
            id: "f-i2",
            text: "Validated on 3 outdoor terrains unseen in training (grass, gravel, pavement).",
          },
          { id: "f-i3", text: "Wrote a CAN base controller and an onboard data pipeline." },
        ],
      },
      {
        id: "pos-lab",
        kind: "position",
        section: "research",
        title: "Student Researcher",
        org: "Legged Lab, Example University",
        subtitle: "PI: Prof. Jane Roe",
        start: "Dec 2023",
        end: "Present",
      },
      {
        id: "prj-biped",
        kind: "project",
        parentId: "pos-lab",
        title: "Penguin-Inspired Biped",
        start: "Aug 2025",
        end: "Present",
        facts: [
          {
            id: "f-b1",
            text: "Built a 5-DOF biped with an adjustable center-of-mass height in SolidWorks.",
          },
          {
            id: "f-b2",
            text: "Penguin gait was 1.8× faster with 44% lower cost of transport at μ = 0.12.",
          },
          { id: "f-b3", text: "Trained CPG-RL policies that climb 6° slopes in Isaac Lab." },
        ],
      },
      {
        id: "pub-waddle",
        kind: "publication",
        parentId: "prj-biped",
        title: "When to Waddle",
        venue: "under review at ICRA 2027",
        role: "Co-First Author",
        url: "https://arxiv.org/abs/2609.00001",
        urlLabel: "arXiv:2609.00001",
      },
      {
        id: "pub-ws",
        kind: "publication",
        parentId: "prj-biped",
        title: "",
        venue: "IROS 2026 workshop",
      },
      {
        id: "demo-nfl",
        kind: "demo",
        parentId: "prj-biped",
        venue: "NFL Draft Tech Day",
        location: "Pittsburgh",
        date: "2026",
      },
      {
        id: "demo-frr",
        kind: "demo",
        parentId: "prj-biped",
        venue: "NSF FRR",
        location: "Pittsburgh",
        date: "2026",
      },
      {
        id: "prj-quad",
        kind: "project",
        title: "Sim-to-Real Quadrotor Landing",
        subtitle: "Course Project, Robot Learning",
        start: "Aug 2025",
        end: "Jan 2026",
        facts: [
          {
            id: "f-q1",
            text: "Curriculum PPO landing on moving targets with <2 cm error and a 96% hardware success rate.",
          },
        ],
      },
    ],
    skills: [
      { name: "Languages", keywords: ["Python", "C++"] },
      { name: "Embedded", keywords: ["CAN", "Arduino"], sameLine: true },
      { name: "Tools", keywords: ["MuJoCo", "Isaac Lab", "PyTorch"] },
    ],
  });
}
