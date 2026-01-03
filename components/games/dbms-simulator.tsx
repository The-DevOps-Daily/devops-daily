'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Database,
  FileText,
  Key,
  Table2,
  GitBranch,
  Clock,
  Zap,
  Shield,
  TrendingUp,
  Network,
  CheckCircle2,
  XCircle,
  Home,
  Play,
  RotateCcw,
  Info,
  ArrowRight,
  Layers,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// DBMS Type
type DbmsType = 'relational' | 'document' | 'key-value' | 'column-family' | 'graph' | 'time-series';

// Phase Type
type Phase = 'intro' | 'explorer' | 'playground' | 'quiz' | 'complete';

// DBMS Configuration
interface DbmsConfig {
  id: DbmsType;
  name: string;
  category: string;
  examples: string[];
  iconName: string;
  color: string;
  characteristics: string[];
  useCases: string[];
  capTradeoffs: { consistency: number; availability: number; partition: number };
  queryExample: string;
  dataModelExample: string;
  pros: string[];
  cons: string[];
}

// DBMS Configurations
const dbmsTypes: Record<DbmsType, DbmsConfig> = {
  relational: {
    id: 'relational',
    name: 'Relational (SQL)',
    category: 'Traditional',
    examples: ['PostgreSQL', 'MySQL', 'SQL Server', 'Oracle'],
    iconName: 'Table2',
    color: 'from-blue-500 to-cyan-600',
    characteristics: [
      'Structured data with schema',
      'Tables with rows and columns',
      'ACID transactions',
      'SQL query language',
      'Relationships via foreign keys',
      'Strong consistency',
    ],
    useCases: [
      'Financial systems',
      'E-commerce transactions',
      'User management',
      'Inventory systems',
      'Structured data with relationships',
    ],
    capTradeoffs: { consistency: 10, availability: 7, partition: 5 },
    queryExample: `SELECT u.name, o.amount\nFROM users u\nJOIN orders o ON u.id = o.user_id\nWHERE o.amount > 50;`,
    dataModelExample: `Users Table\n+----+----------+-------+\n| id | name     | email |\n+----+----------+-------+\n| 1  | John Doe | john@ |\n+----+----------+-------+\n\nOrders Table\n+----+---------+--------+\n| id | user_id | amount |\n+----+---------+--------+\n| 1  | 1       | 99.99  |\n+----+---------+--------+`,
    pros: ['ACID guarantees', 'Complex queries with JOINs', 'Data integrity', 'Mature tooling'],
    cons: ['Rigid schema', 'Vertical scaling limits', 'Complex migrations', 'Performance at scale'],
  },
  document: {
    id: 'document',
    name: 'Document Database',
    category: 'NoSQL',
    examples: ['MongoDB', 'CouchDB', 'Firestore'],
    iconName: 'FileText',
    color: 'from-green-500 to-emerald-600',
    characteristics: [
      'Schema-less (flexible schema)',
      'Store JSON-like documents',
      'Nested data structures',
      'No joins (denormalized)',
      'Horizontal scaling',
      'Eventually consistent',
    ],
    useCases: [
      'Content management systems',
      'User profiles',
      'Product catalogs',
      'Blogs and articles',
      'Mobile app backends',
    ],
    capTradeoffs: { consistency: 7, availability: 9, partition: 9 },
    queryExample: `db.users.find({\n  "orders.amount": { "$gt": 50 }\n}).project({\n  name: 1,\n  "orders.amount": 1\n})`,
    dataModelExample: `{\n  "_id": "123",\n  "name": "John Doe",\n  "email": "john@example.com",\n  "orders": [\n    { "id": 1, "amount": 99.99 },\n    { "id": 2, "amount": 49.99 }\n  ]\n}`,
    pros: ['Flexible schema', 'Easy horizontal scaling', 'Fast reads', 'Nested data support'],
    cons: ['No ACID across documents', 'Data duplication', 'Complex joins difficult', 'Eventual consistency'],
  },
  'key-value': {
    id: 'key-value',
    name: 'Key-Value Store',
    category: 'NoSQL',
    examples: ['Redis', 'Memcached', 'DynamoDB'],
    iconName: 'Key',
    color: 'from-red-500 to-orange-600',
    characteristics: [
      'Simplest NoSQL model',
      'Key maps to value',
      'Very fast lookups O(1)',
      'No complex queries',
      'Often in-memory',
      'TTL support',
    ],
    useCases: [
      'Caching',
      'Session storage',
      'Rate limiting',
      'Real-time analytics',
      'Leaderboards',
    ],
    capTradeoffs: { consistency: 8, availability: 10, partition: 8 },
    queryExample: `GET user:123\nSET session:abc '{"user_id":123}' EX 3600\nINCR page:views\nZADD leaderboard 1000 "player1"`,
    dataModelExample: `Key: "user:123"\nValue: {"name": "John", "email": "john@example.com"}\n\nKey: "session:abc"\nValue: {"user_id": 123, "expires": 1234567890}\n\nKey: "counter:page:views"\nValue: 42`,
    pros: ['Extremely fast', 'Simple to use', 'High throughput', 'Easy to scale'],
    cons: ['No complex queries', 'No relationships', 'Limited data types', 'Not for complex data'],
  },
  'column-family': {
    id: 'column-family',
    name: 'Column-Family Store',
    category: 'NoSQL',
    examples: ['Cassandra', 'HBase', 'ScyllaDB'],
    iconName: 'Layers',
    color: 'from-purple-500 to-pink-600',
    characteristics: [
      'Data stored in column families',
      'Wide rows with many columns',
      'Optimized for writes',
      'Distributed architecture',
      'Tunable consistency',
      'No joins',
    ],
    useCases: [
      'Time-series data',
      'Event logging',
      'IoT sensor data',
      'High write volume',
      'Historical data storage',
    ],
    capTradeoffs: { consistency: 7, availability: 10, partition: 10 },
    queryExample: `SELECT * FROM sensor_data\nWHERE device_id = 'dev123'\n  AND timestamp > '2024-01-01'\nORDER BY timestamp DESC;`,
    dataModelExample: `Row Key: device_123\nColumn Family: measurements\n  timestamp:2024-01-01T10:00:00 -> {temp: 22.5}\n  timestamp:2024-01-01T10:01:00 -> {temp: 22.7}\n  timestamp:2024-01-01T10:02:00 -> {temp: 22.6}`,
    pros: ['High write throughput', 'Linear scaling', 'Fault tolerant', 'Tunable consistency'],
    cons: ['Complex data modeling', 'No joins', 'Limited query flexibility', 'Steep learning curve'],
  },
  graph: {
    id: 'graph',
    name: 'Graph Database',
    category: 'NoSQL',
    examples: ['Neo4j', 'Amazon Neptune', 'ArangoDB'],
    iconName: 'GitBranch',
    color: 'from-indigo-500 to-violet-600',
    characteristics: [
      'Nodes and relationships',
      'Optimized for connections',
      'Graph traversal queries',
      'ACID support',
      'Property graphs',
      'Deep relationship queries',
    ],
    useCases: [
      'Social networks',
      'Recommendation engines',
      'Fraud detection',
      'Knowledge graphs',
      'Network topology',
    ],
    capTradeoffs: { consistency: 9, availability: 7, partition: 6 },
    queryExample: `MATCH (user:User {name: "John"})\n      -[:FRIEND]->(friend)\n      -[:BOUGHT]->(product)\nWHERE product.price > 50\nRETURN friend.name, product.name`,
    dataModelExample: `(User:John)\n  -[:FRIEND]->(User:Alice)\n  -[:BOUGHT]->(Product:Laptop)\n  \n(User:Alice)\n  -[:BOUGHT]->(Product:Laptop)\n  -[:BOUGHT]->(Product:Mouse)`,
    pros: ['Fast relationship queries', 'Intuitive data model', 'Complex traversals', 'Pattern matching'],
    cons: ['Not for simple lookups', 'Scaling challenges', 'Specialized use case', 'Query complexity'],
  },
  'time-series': {
    id: 'time-series',
    name: 'Time-Series Database',
    category: 'Specialized',
    examples: ['InfluxDB', 'TimescaleDB', 'Prometheus'],
    iconName: 'Clock',
    color: 'from-yellow-500 to-amber-600',
    characteristics: [
      'Optimized for time-stamped data',
      'Continuous data flow',
      'Data retention policies',
      'Downsampling support',
      'High write throughput',
      'Built-in aggregations',
    ],
    useCases: [
      'Monitoring and metrics',
      'IoT sensor data',
      'Financial tick data',
      'Application performance',
      'Infrastructure monitoring',
    ],
    capTradeoffs: { consistency: 8, availability: 9, partition: 8 },
    queryExample: `SELECT mean("temperature")\nFROM "sensor_data"\nWHERE time > now() - 1h\nGROUP BY time(5m), "device_id"`,
    dataModelExample: `Measurement: cpu_usage\nTags: {host: "server-1", region: "us-east"}\nFields: {value: 75.5}\nTimestamp: 2024-01-01T10:00:00Z\n\nMeasurement: cpu_usage\nTags: {host: "server-1", region: "us-east"}\nFields: {value: 78.2}\nTimestamp: 2024-01-01T10:01:00Z`,
    pros: ['Optimized for time data', 'Efficient storage', 'Built-in aggregations', 'Data retention'],
    cons: ['Specialized use case', 'Not for general data', 'Update limitations', 'Delete constraints'],
  },
};

// Quiz Questions
const quizQuestions = [
  {
    question: 'You need ACID transactions for a financial system. Which DBMS should you choose?',
    options: ['MongoDB', 'PostgreSQL', 'Redis', 'Cassandra'],
    correctAnswer: 1,
    explanation: 'PostgreSQL (relational) provides full ACID guarantees, which are critical for financial transactions where consistency and integrity are paramount.',
  },
  {
    question: 'Which database is best for storing session data with fast lookups and TTL support?',
    options: ['MySQL', 'Neo4j', 'Redis', 'HBase'],
    correctAnswer: 2,
    explanation: 'Redis (key-value store) is perfect for session storage with its in-memory speed, simple key-value model, and built-in TTL (Time To Live) support.',
  },
  {
    question: 'For a social network with friend recommendations, which database works best?',
    options: ['PostgreSQL', 'Cassandra', 'Neo4j', 'DynamoDB'],
    correctAnswer: 2,
    explanation: 'Neo4j (graph database) is optimized for relationship queries like "friends of friends" which are essential for social networks and recommendations.',
  },
  {
    question: 'You have IoT sensors generating millions of time-stamped readings. Best choice?',
    options: ['InfluxDB', 'MongoDB', 'Redis', 'MySQL'],
    correctAnswer: 0,
    explanation: 'InfluxDB (time-series database) is specifically designed for high-volume time-stamped data with efficient storage, retention policies, and aggregations.',
  },
];

export default function DbmsSimulator() {
  const [phase, setPhase] = useState<Phase>('intro');
  const [selectedDbms, setSelectedDbms] = useState<DbmsType>('relational');
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [score, setScore] = useState(0);

  const handleDbmsSelect = useCallback((type: DbmsType) => {
    setSelectedDbms(type);
  }, []);

  const resetGame = useCallback(() => {
    setPhase('intro');
    setSelectedDbms('relational');
    setCurrentQuestion(0);
    setSelectedAnswer(null);
    setShowExplanation(false);
    setScore(0);
  }, []);

  const handleAnswerSelect = useCallback(
    (answerIndex: number) => {
      setSelectedAnswer(answerIndex);
      setShowExplanation(true);

      if (answerIndex === quizQuestions[currentQuestion].correctAnswer) {
        setScore((prev) => prev + 1);
      }
    },
    [currentQuestion]
  );

  const handleNextQuestion = useCallback(() => {
    if (currentQuestion < quizQuestions.length - 1) {
      setCurrentQuestion((prev) => prev + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
    } else {
      setPhase('complete');
    }
  }, [currentQuestion]);

  const getIconComponent = (iconName: string) => {
    const icons: Record<string, React.ReactNode> = {
      Table2: <Table2 className="h-8 w-8" />,
      FileText: <FileText className="h-8 w-8" />,
      Key: <Key className="h-8 w-8" />,
      Layers: <Layers className="h-8 w-8" />,
      GitBranch: <GitBranch className="h-8 w-8" />,
      Clock: <Clock className="h-8 w-8" />,
    };
    return icons[iconName] || <Database className="h-8 w-8" />;
  };

  // Intro Phase
  if (phase === 'intro') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <div className="inline-flex items-center gap-2 mb-4 px-4 py-2 bg-blue-100 dark:bg-blue-900/30 rounded-full">
              <Database className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Interactive Learning</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-cyan-600 dark:from-blue-400 dark:to-cyan-400 bg-clip-text text-transparent">
              Database Management Systems
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Learn about different types of databases, their use cases, and trade-offs through interactive exploration
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="mb-6 border-2 border-blue-200 dark:border-blue-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  What You'll Learn
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">DBMS Types</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Relational, Document, Key-Value, Column-Family, Graph, Time-Series
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Use Cases</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        When to use each type for real-world applications
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">CAP Theorem</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Understand trade-offs between consistency, availability, and partition tolerance
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Query Patterns</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        See how queries differ across database types
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex gap-4 justify-center"
          >
            <Button size="lg" onClick={() => setPhase('explorer')} className="gap-2">
              <Play className="h-5 w-5" />
             Start Exploring
           </Button>
         </motion.div>
       </div>
      </div>
    );
  }

  // Explorer Phase
  if (phase === 'explorer') {
    const currentDbms = dbmsTypes[selectedDbms];

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-wrap items-center justify-between mb-6 gap-4"
          >
            <div>
              <h2 className="text-2xl font-bold">Database Explorer</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">Select a database type to learn more</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setPhase('playground')} className="gap-2">
                <ArrowRight className="h-4 w-4" />
                Try Playground
              </Button>
              <Button variant="outline" onClick={() => setPhase('intro')} className="gap-2">
                <Home className="h-4 w-4" />
                Home
              </Button>
            </div>
          </motion.div>

          {/* DBMS Type Selector */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8"
          >
            {(Object.keys(dbmsTypes) as DbmsType[]).map((type) => {
              const dbms = dbmsTypes[type];
              const isSelected = selectedDbms === type;
              return (
                <motion.button
                  key={type}
                  onClick={() => handleDbmsSelect(type)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={cn(
                    'p-4 rounded-xl border-2 transition-all',
                    isSelected
                      ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 bg-white dark:bg-slate-800'
                  )}
                >
                  <div className="text-center">
                    <div className={cn(
                      'mx-auto mb-2 w-12 h-12 rounded-lg flex items-center justify-center',
                      `bg-gradient-to-br ${dbms.color}`
                    )}>
                      <div className="text-white">{getIconComponent(dbms.iconName)}</div>
                    </div>
                    <p className="text-sm font-medium">{dbms.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{dbms.category}</p>
                  </div>
                </motion.button>
              );
            })}
          </motion.div>

          {/* Current DBMS Details */}
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedDbms}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="grid lg:grid-cols-2 gap-6"
            >
              {/* Left Column */}
              <div className="space-y-6">
                {/* Overview Card */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-12 h-12 rounded-lg flex items-center justify-center',
                        `bg-gradient-to-br ${currentDbms.color}`
                      )}>
                        <div className="text-white">{getIconComponent(currentDbms.iconName)}</div>
                      </div>
                      <div>
                        <CardTitle>{currentDbms.name}</CardTitle>
                        <CardDescription>{currentDbms.category}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm font-medium mb-2">Popular Examples:</p>
                        <div className="flex flex-wrap gap-2">
                          {currentDbms.examples.map((example) => (
                            <Badge key={example} variant="secondary">
                              {example}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Characteristics Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Key Characteristics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {currentDbms.characteristics.map((char, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                          <span className="text-sm">{char}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                {/* Use Cases Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Best Use Cases</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {currentDbms.useCases.map((useCase, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <Zap className="h-4 w-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                          <span className="text-sm">{useCase}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                {/* Data Model Example */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Data Model</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-xs bg-slate-100 dark:bg-slate-900 p-4 rounded-lg overflow-x-auto">
                      <code>{currentDbms.dataModelExample}</code>
                    </pre>
                  </CardContent>
                </Card>

                {/* Query Example */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Query Example</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-xs bg-slate-100 dark:bg-slate-900 p-4 rounded-lg overflow-x-auto">
                      <code>{currentDbms.queryExample}</code>
                    </pre>
                  </CardContent>
                </Card>

                {/* CAP Theorem */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">CAP Theorem Trade-offs</CardTitle>
                    <CardDescription>Rated 1-10 for each property</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Consistency</span>
                          <span className="font-medium">{currentDbms.capTradeoffs.consistency}/10</span>
                        </div>
                        <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500"
                            style={{ width: `${currentDbms.capTradeoffs.consistency * 10}%` }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Availability</span>
                          <span className="font-medium">{currentDbms.capTradeoffs.availability}/10</span>
                        </div>
                        <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500"
                            style={{ width: `${currentDbms.capTradeoffs.availability * 10}%` }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Partition Tolerance</span>
                          <span className="font-medium">{currentDbms.capTradeoffs.partition}/10</span>
                        </div>
                        <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-purple-500"
                            style={{ width: `${currentDbms.capTradeoffs.partition * 10}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Pros and Cons */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Pros & Cons</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm font-medium mb-2 text-green-600 dark:text-green-400">Advantages</p>
                        <ul className="space-y-1">
                          {currentDbms.pros.map((pro, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                              <span className="text-sm">{pro}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="text-sm font-medium mb-2 text-red-600 dark:text-red-400">Limitations</p>
                        <ul className="space-y-1">
                          {currentDbms.cons.map((con, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <XCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                              <span className="text-sm">{con}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    );
  }

  // Playground Phase
  if (phase === 'playground') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-6">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <h2 className="text-3xl font-bold mb-4">Decision Playground</h2>
            <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Use this decision tree to help you choose the right database for your use case
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Which DBMS Should I Use?</CardTitle>
                <CardDescription>Answer these questions to find the best match</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Decision Tree Visualization */}
                  <div className="bg-slate-100 dark:bg-slate-900 p-6 rounded-lg">
                    <div className="space-y-4 text-sm">
                      <div className="font-medium">Need ACID transactions?</div>
                      <div className="ml-4 space-y-2">
                        <div>✅ Yes → <Badge className="bg-blue-500">Relational Database</Badge></div>
                        <div>
                          ❌ No
                          <div className="ml-4 mt-2 space-y-2">
                            <div className="font-medium">Need complex relationships?</div>
                            <div className="ml-4 space-y-2">
                              <div>✅ Yes → <Badge className="bg-indigo-500">Graph Database</Badge></div>
                              <div>
                                ❌ No
                                <div className="ml-4 mt-2 space-y-2">
                                  <div className="font-medium">Need fast simple lookups?</div>
                                  <div className="ml-4 space-y-2">
                                    <div>✅ Yes → <Badge className="bg-red-500">Key-Value Store</Badge></div>
                                    <div>
                                      ❌ No
                                      <div className="ml-4 mt-2 space-y-2">
                                        <div className="font-medium">Need flexible schema?</div>
                                        <div className="ml-4 space-y-2">
                                          <div>✅ Yes → <Badge className="bg-green-500">Document Database</Badge></div>
                                          <div>❌ No → <Badge className="bg-purple-500">Column-Family Store</Badge></div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Common Use Cases */}
                  <div>
                    <h3 className="font-medium mb-3">Common Scenarios</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      <Alert>
                        <Shield className="h-4 w-4" />
                        <AlertDescription>
                          <p className="font-medium mb-1">E-Commerce</p>
                          <p className="text-xs">Relational for orders, Document for catalog, Redis for sessions</p>
                        </AlertDescription>
                      </Alert>
                      <Alert>
                        <Users className="h-4 w-4" />
                        <AlertDescription>
                          <p className="font-medium mb-1">Social Network</p>
                          <p className="text-xs">Graph for connections, Document for profiles, Redis for cache</p>
                        </AlertDescription>
                      </Alert>
                      <Alert>
                        <Network className="h-4 w-4" />
                        <AlertDescription>
                          <p className="font-medium mb-1">IoT Platform</p>
                          <p className="text-xs">Time-series for sensors, Column-family for logs, Redis for state</p>
                        </AlertDescription>
                      </Alert>
                      <Alert>
                        <TrendingUp className="h-4 w-4" />
                        <AlertDescription>
                          <p className="font-medium mb-1">Analytics Platform</p>
                          <p className="text-xs">Column-family for events, Time-series for metrics, Relational for metadata</p>
                        </AlertDescription>
                      </Alert>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex gap-4 justify-center"
          >
            <Button onClick={() => setPhase('quiz')} className="gap-2">
              <ArrowRight className="h-4 w-4" />
              Take Quiz
            </Button>
            <Button variant="outline" onClick={() => setPhase('explorer')} className="gap-2">
              Back to Explorer
            </Button>
          </motion.div>
        </div>
      </div>
    );
  }

  // Quiz Phase
  if (phase === 'quiz') {
    const question = quizQuestions[currentQuestion];

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-6">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Knowledge Check</h2>
              <Badge variant="secondary">
                Question {currentQuestion + 1} of {quizQuestions.length}
              </Badge>
            </div>
            <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${((currentQuestion + 1) / quizQuestions.length) * 100}%` }}
              />
            </div>
          </motion.div>

          <motion.div
            key={currentQuestion}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>{question.question}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {question.options.map((option, idx) => {
                    const isSelected = selectedAnswer === idx;
                    const isCorrect = idx === question.correctAnswer;
                    const showResult = showExplanation;

                    return (
                      <Button
                        key={idx}
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left h-auto py-3 px-4',
                          isSelected && !showResult && 'border-blue-500 bg-blue-50 dark:bg-blue-900/20',
                          showResult && isCorrect && 'border-green-500 bg-green-50 dark:bg-green-900/20',
                          showResult && isSelected && !isCorrect && 'border-red-500 bg-red-50 dark:bg-red-900/20'
                        )}
                        onClick={() => !showExplanation && handleAnswerSelect(idx)}
                        disabled={showExplanation}
                      >
                        <div className="flex items-center gap-3 w-full">
                          <div className={cn(
                            'w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                            showResult && isCorrect && 'border-green-500 bg-green-500',
                            showResult && isSelected && !isCorrect && 'border-red-500 bg-red-500'
                          )}>
                            {showResult && isCorrect && <CheckCircle2 className="h-4 w-4 text-white" />}
                            {showResult && isSelected && !isCorrect && <XCircle className="h-4 w-4 text-white" />}
                          </div>
                          <span>{option}</span>
                        </div>
                      </Button>
                    );
                  })}
                </div>

                <AnimatePresence>
                  {showExplanation && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-4"
                    >
                      <Alert className={cn(
                        selectedAnswer === question.correctAnswer
                          ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                          : 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      )}>
                        <Info className="h-4 w-4" />
                        <AlertDescription>
                          <p className="font-medium mb-1">
                            {selectedAnswer === question.correctAnswer ? 'Correct!' : 'Not quite!'}
                          </p>
                          <p className="text-sm">{question.explanation}</p>
                        </AlertDescription>
                      </Alert>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </motion.div>

          <div className="flex gap-4 justify-center">
            {showExplanation && (
              <Button onClick={handleNextQuestion} className="gap-2">
                {currentQuestion < quizQuestions.length - 1 ? (
                  <>
                    Next Question
                    <ArrowRight className="h-4 w-4" />
                  </>
                ) : (
                  'See Results'
                )}
              </Button>
            )}
            <Button variant="outline" onClick={resetGame} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Start Over
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Complete Phase
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-6">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 mb-6">
            <CheckCircle2 className="h-10 w-10 text-white" />
          </div>
          <h2 className="text-3xl font-bold mb-4">Quiz Complete!</h2>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            You scored <span className="font-bold text-blue-600 dark:text-blue-400">{score}</span> out of{' '}
            <span className="font-bold">{quizQuestions.length}</span>
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Key Takeaways</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Match DBMS to Use Case</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Different databases excel at different tasks - choose based on your requirements
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Understand CAP Trade-offs</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      You can't have perfect consistency, availability, and partition tolerance simultaneously
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Polyglot Persistence is Common</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Modern applications often use multiple databases for different components
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Consider Operational Complexity</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Each database type has different operational requirements and trade-offs
                    </p>
                  </div>
                </li>
              </ul>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex gap-4 justify-center"
        >
          <Button onClick={resetGame} className="gap-2">
            <RotateCcw className="h-4 w-4" />
           Play Again
         </Button>
       </motion.div>
     </div>
   </div>
  );
}
