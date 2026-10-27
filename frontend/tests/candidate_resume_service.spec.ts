import { test, expect } from '@playwright/test';
import http from '../src/lib/http';
import { candidatesService } from '../src/services/candidates.service';

test.describe('Candidate Multi-Format Resume Service Unit Tests', () => {
  test('test case 1: uploadNewResume dispatches multipart/form-data to /candidates/upload', async () => {
    const originalPost = http.post;
    let capturedUrl = '';
    let capturedData: any = null;
    let capturedConfig: any = null;

    const mockResponseData = {
      status: 'success',
      candidate: {
        id: '00000000-0000-0000-0000-000000000001',
        first_name: 'Jane',
        last_name: 'Doe',
        email: 'jane.doe@example.com',
        title: 'Principal Systems Architect',
        company: 'CloudScale Tech',
        skills: ['Kubernetes', 'Go', 'Kafka'],
        score: 94,
        source: 'Resume Upload',
      },
      parsed_data: {
        skills: ['Kubernetes', 'Go', 'Kafka'],
        experience: [
          {
            title: 'Principal Systems Architect',
            company: 'CloudScale Tech',
            dates: '2021 - Present',
          },
        ],
        education: [
          {
            degree: 'B.S. in Computer Science',
            institution: 'MIT',
          },
        ],
      },
    };

    http.post = (async (url: string, data: any, config: any) => {
      capturedUrl = url;
      capturedData = data;
      capturedConfig = config;
      return { data: mockResponseData };
    }) as any;

    try {
      const dummyFile = new File([new Uint8Array([1, 2, 3])], 'jane_doe_cv.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      const result = await candidatesService.uploadNewResume(dummyFile);

      expect(capturedUrl).toBe('/candidates/upload');
      expect(capturedConfig?.headers?.['Content-Type']).toBe('multipart/form-data');
      expect(capturedData).toBeInstanceOf(FormData);
      expect(capturedData.get('file')).toBeTruthy();

      expect(result.status).toBe('success');
      expect(result.candidate.first_name).toBe('Jane');
      expect(result.candidate.email).toBe('jane.doe@example.com');
      expect(result.parsed_data.skills).toContain('Kubernetes');
      expect(result.parsed_data.experience.length).toBe(1);
    } finally {
      http.post = originalPost;
    }
  });

  test('test case 2: getResumeDetails retrieves structured timeline and raw text from /candidates/{id}/resume/details', async () => {
    const originalGet = http.get;
    let capturedUrl = '';

    const mockDetails = {
      has_resume: true,
      resume_id: 'res_998877',
      file_name: 'jane_doe_cv.docx',
      raw_text: 'Jane Doe\\nPrincipal Systems Architect\\nCloudScale Tech',
      skills: ['Go', 'Kubernetes', 'Kafka'],
      experience: [
        {
          title: 'Principal Systems Architect',
          company: 'CloudScale Tech',
        },
      ],
      education: [
        {
          degree: 'B.S. in Computer Science',
          institution: 'MIT',
        },
      ],
    };

    http.get = (async (url: string) => {
      capturedUrl = url;
      return { data: mockDetails };
    }) as any;

    try {
      const candidateId = '00000000-0000-0000-0000-000000000001';
      const result = await candidatesService.getResumeDetails(candidateId);

      expect(capturedUrl).toBe(`/candidates/${candidateId}/resume/details`);
      expect(result.has_resume).toBe(true);
      expect(result.file_name).toBe('jane_doe_cv.docx');
      expect(result.skills).toContain('Go');
      expect(result.raw_text).toContain('Principal Systems Architect');
    } finally {
      http.get = originalGet;
    }
  });

  test('test case 3: uploadResume attaches resume version to existing candidate profile', async () => {
    const originalPost = http.post;
    let capturedUrl = '';
    let capturedConfig: any = null;

    const mockResponseData = {
      message: "Resume 'updated_cv.pdf' uploaded and parsed successfully.",
      resume_id: 'res_112233',
      skills_detected: ['Python', 'Docker', 'AWS'],
      experience_detected: 2,
    };

    http.post = (async (url: string, data: any, config: any) => {
      capturedUrl = url;
      capturedConfig = config;
      return { data: mockResponseData };
    }) as any;

    try {
      const candidateId = 'cand_existing_42';
      const dummyFile = new File([new Uint8Array([4, 5, 6])], 'updated_cv.pdf', {
        type: 'application/pdf',
      });

      const result = await candidatesService.uploadResume(candidateId, dummyFile);

      expect(capturedUrl).toBe(`/candidates/${candidateId}/resume`);
      expect(capturedConfig?.headers?.['Content-Type']).toBe('multipart/form-data');
      expect(result.resume_id).toBe('res_112233');
      expect(result.skills_detected).toContain('Python');
      expect(result.experience_detected).toBe(2);
    } finally {
      http.post = originalPost;
    }
  });
});
